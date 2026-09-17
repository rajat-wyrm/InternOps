const Fastify = require('fastify');
const proofRoutes = require('../../src/modules/proof-submissions/routes');
const proofService = require('../../src/modules/proof-submissions/service');
const verificationService = require('../../src/modules/proof-submissions/verification.service');
const repo = require('../../src/modules/proof-submissions/repository');
const socialTasksRepo = require('../../src/modules/social-tasks/repository');
const crawlerService = require('../../src/modules/social-tasks/crawler.service');
const aiVerifyService = require('../../src/modules/social-tasks/ai-verify.service');
const { checkHierarchyAccess } = require('../../src/utils/hierarchy');

// Mock dependencies
jest.mock('../../src/modules/proof-submissions/repository');
jest.mock('../../src/modules/social-tasks/repository');
jest.mock('../../src/modules/social-tasks/crawler.service');
jest.mock('../../src/modules/social-tasks/ai-verify.service');
jest.mock('../../src/utils/hierarchy');
const authHandler = async (req, reply) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (token === 'invalid-token') {
    return reply.status(401).send({ error: 'Invalid token' });
  }
  const [role, userId] = token.split(':');
  req.user = {
    id: userId || 'user-123',
    role: role || 'INTERN',
  };
};

jest.mock('../../src/middleware/auth', () => {
  return jest.fn(async (req, reply) => {
    return authHandler(req, reply);
  });
});

const authMock = require('../../src/middleware/auth');

describe('Issue #1642: Proof Verification Service and Flow', () => {
  let app;

  beforeAll(async () => {
    app = Fastify();
    // Register routes under both prefixes to test standard API and v1 versioning
    app.register(proofRoutes, { prefix: '/api/v1/proofs' });
    app.register(proofRoutes, { prefix: '/api/proofs' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockImplementation(authHandler);
    checkHierarchyAccess.mockReset();
    checkHierarchyAccess.mockResolvedValue(true);
    repo.getProof.mockReset();
    repo.saveVerificationResult.mockReset();
    socialTasksRepo.getTaskById.mockReset();
    crawlerService.fetchProofContent.mockReset();
    aiVerifyService.verifyClaim.mockReset();
  });

  describe('Verification Service - Core Flow & Advisory Checks', () => {
    const mockProof = {
      id: 'proof-001',
      task_id: 'task-001',
      intern_id: 'intern-001',
      did_comment: true,
      did_repost: false,
      did_share: true,
      status: 'PENDING',
      verification_result: null,
    };

    const mockTask = {
      id: 'task-001',
      task_link: 'https://twitter.com/test/status/12345',
      title: 'Share product launch',
    };

    it('3, 4, 5: calls fetchProofContent, verifyClaim with appropriate data, and persists verification_result', async () => {
      repo.getProof.mockResolvedValueOnce(mockProof);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);
      crawlerService.fetchProofContent.mockResolvedValueOnce({
        success: true,
        content: JSON.stringify({
          text: 'Launch announcement',
          comments: ['Great product!'],
        }),
      });
      const mockClaimResult = [
        {
          action: 'did_comment',
          confidence: 'high',
          supports: true,
          notes: 'Comment found',
        },
        {
          action: 'did_share',
          confidence: 'medium',
          supports: true,
          notes: 'Retweet detected',
        },
      ];
      aiVerifyService.verifyClaim.mockResolvedValueOnce(mockClaimResult);
      repo.saveVerificationResult.mockResolvedValueOnce({
        ...mockProof,
        verification_result: mockClaimResult,
      });

      const result = await verificationService.verifyProof('proof-001');

      // 3. fetchProofContent is called with task_link
      expect(crawlerService.fetchProofContent).toHaveBeenCalledWith(
        'https://twitter.com/test/status/12345'
      );

      // 4. verifyClaim is called with appropriate content and claimedActions
      expect(aiVerifyService.verifyClaim).toHaveBeenCalledWith({
        content: JSON.stringify({
          text: 'Launch announcement',
          comments: ['Great product!'],
        }),
        claimedActions: {
          did_comment: true,
          did_repost: false,
          did_share: true,
        },
      });

      // 5. verification_result is persisted
      expect(repo.saveVerificationResult).toHaveBeenCalledWith(
        'proof-001',
        mockClaimResult
      );

      expect(result.status).toBe('completed');
      expect(result.verification).toEqual(mockClaimResult);
      expect(result.advisory).toBe(true);
    });

    it('14, 15: verification is advisory only and never automatically approves or rejects proof status', async () => {
      repo.getProof.mockResolvedValueOnce(mockProof);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);
      crawlerService.fetchProofContent.mockResolvedValueOnce({
        success: true,
        content: 'page content',
      });
      const allSupported = [
        { action: 'did_comment', confidence: 'high', supports: true },
        { action: 'did_share', confidence: 'high', supports: true },
      ];
      aiVerifyService.verifyClaim.mockResolvedValueOnce(allSupported);
      repo.saveVerificationResult.mockResolvedValueOnce({
        ...mockProof,
        verification_result: allSupported,
      });

      // Spy on repo.verifyProof (which would change status to VERIFIED)
      const verifyProofSpy = jest.spyOn(repo, 'verifyProof');

      await verificationService.verifyProof('proof-001');

      // verifyProof (status changer) must NEVER be called
      expect(verifyProofSpy).not.toHaveBeenCalled();

      // Only saveVerificationResult must be called to update verification_result column
      expect(repo.saveVerificationResult).toHaveBeenCalledWith(
        'proof-001',
        allSupported
      );

      // Status remains 'PENDING'
      expect(mockProof.status).toBe('PENDING');
    });

    it('12: fetchProofContent failure is handled safely without throwing', async () => {
      repo.getProof.mockResolvedValueOnce(mockProof);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);
      crawlerService.fetchProofContent.mockResolvedValueOnce({
        success: false,
        error: 'Proof URL domain is not allowed',
      });

      const result = await verificationService.verifyProof('proof-001');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Proof URL domain is not allowed');
      expect(repo.saveVerificationResult).toHaveBeenCalledWith(
        'proof-001',
        expect.objectContaining({
          status: 'failed',
          error: 'Proof URL domain is not allowed',
        })
      );
      // verifyClaim should not be called if crawler failed
      expect(aiVerifyService.verifyClaim).not.toHaveBeenCalled();
    });

    it('13: verifyClaim failure is handled safely without throwing', async () => {
      repo.getProof.mockResolvedValueOnce(mockProof);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);
      crawlerService.fetchProofContent.mockResolvedValueOnce({
        success: true,
        content: 'crawled data',
      });
      aiVerifyService.verifyClaim.mockRejectedValueOnce(
        new Error('AI rate limit exceeded')
      );

      const result = await verificationService.verifyProof('proof-001');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('AI rate limit exceeded');
      expect(repo.saveVerificationResult).toHaveBeenCalledWith(
        'proof-001',
        expect.objectContaining({
          status: 'failed',
          error: 'AI rate limit exceeded',
        })
      );
    });

    it('handles task without task_link safely', async () => {
      repo.getProof.mockResolvedValueOnce(mockProof);
      socialTasksRepo.getTaskById.mockResolvedValueOnce({
        id: 'task-001',
        task_link: null,
      });

      const result = await verificationService.verifyProof('proof-001');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Task does not have a proof URL');
      expect(crawlerService.fetchProofContent).not.toHaveBeenCalled();
    });
  });

  describe('Proof Submission Flow & Non-blocking Guarantee', () => {
    it('1, 2, 16: proof submission returns successfully without waiting for verification and triggers job', async () => {
      repo.isTaskAssignedToUser.mockResolvedValueOnce(true);
      const mockSavedProof = {
        id: 'proof-new-123',
        task_id: 'task-001',
        intern_id: 'intern-001',
        status: 'PENDING',
      };
      repo.submitProofWithImages.mockResolvedValueOnce(mockSavedProof);

      // Spy on enqueueProofVerification
      const enqueueSpy = jest.spyOn(
        verificationService,
        'enqueueProofVerification'
      );

      const filesData = [
        {
          filename: 'test.png',
          mimetype: 'image/png',
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
          ]),
        },
      ];

      // Mock saveFiles internal behavior
      const origSaveFiles = proofService.saveFiles;
      proofService.saveFiles = jest
        .fn()
        .mockResolvedValueOnce(['uploads/mock.png']);

      const startTime = Date.now();
      const submitted = await proofService.submitProof('intern-001', {
        task_id: 'task-001',
        didComment: true,
        didRepost: false,
        didShare: false,
        filesData,
      });
      const duration = Date.now() - startTime;

      proofService.saveFiles = origSaveFiles;

      // 1. Returns successfully with the created proof
      expect(submitted).toEqual(mockSavedProof);

      // 2. Verification job is triggered after submission
      expect(enqueueSpy).toHaveBeenCalledWith('proof-new-123', {
        isBackground: true,
      });

      // 16. Did not block execution
      expect(duration).toBeLessThan(100);
    });

    it('16: slow or failing verification does not fail proof submission', async () => {
      repo.isTaskAssignedToUser.mockResolvedValueOnce(true);
      const mockSavedProof = {
        id: 'proof-err-123',
        task_id: 'task-001',
        intern_id: 'intern-001',
        status: 'PENDING',
      };
      repo.submitProofWithImages.mockResolvedValueOnce(mockSavedProof);

      // Mock enqueue to throw an unexpected error
      const enqueueSpy = jest
        .spyOn(verificationService, 'enqueueProofVerification')
        .mockImplementationOnce(() => {
          throw new Error('Queue connection dropped');
        });

      const filesData = [
        {
          filename: 'test.png',
          mimetype: 'image/png',
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
          ]),
        },
      ];

      const origSaveFiles = proofService.saveFiles;
      proofService.saveFiles = jest
        .fn()
        .mockResolvedValueOnce(['uploads/mock.png']);

      // Proof submission should still succeed normally despite enqueue failure
      const submitted = await proofService.submitProof('intern-001', {
        task_id: 'task-001',
        didComment: true,
        didRepost: false,
        didShare: false,
        filesData,
      });

      proofService.saveFiles = origSaveFiles;
      enqueueSpy.mockRestore();

      expect(submitted).toEqual(mockSavedProof);
    });
  });

  describe('GET /api/proofs/:id/verification Endpoint & RBAC', () => {
    const mockVerifiedProof = {
      id: 'proof-view-1',
      task_id: 'task-001',
      intern_id: 'intern-target',
      verification_result: [
        {
          action: 'did_comment',
          confidence: 'high',
          supports: true,
          notes: 'Found comment',
        },
      ],
      status: 'PENDING',
    };

    it('6, 9: authorized reviewer can view verification result via GET /api/proofs/:id/verification', async () => {
      repo.getProof.mockResolvedValueOnce(mockVerifiedProof);
      checkHierarchyAccess.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-1/verification',
        headers: {
          authorization: 'Bearer TL:reviewer-tl',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.proofId).toBe('proof-view-1');
      expect(body.status).toBe('completed');
      expect(body.verification).toEqual(mockVerifiedProof.verification_result);
      expect(body.advisory).toBe(true);
    });

    it('returns pending status when verification has not yet completed', async () => {
      repo.getProof.mockResolvedValueOnce({
        id: 'proof-view-pending',
        task_id: 'task-001',
        intern_id: 'intern-target',
        verification_result: null,
        status: 'PENDING',
      });
      checkHierarchyAccess.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-pending/verification',
        headers: {
          authorization: 'Bearer TL:reviewer-tl',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('pending');
      expect(body.verification).toBeNull();
      expect(body.advisory).toBe(true);
    });

    it('works under /api/v1/proofs/:id/verification as well', async () => {
      repo.getProof.mockResolvedValueOnce(mockVerifiedProof);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/proofs/proof-view-1/verification',
        headers: {
          authorization: 'Bearer ADMIN:admin-user',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.proofId).toBe('proof-view-1');
    });

    it('7: unauthorized user (no token) cannot view verification (401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-1/verification',
      });

      expect(res.statusCode).toBe(401);
    });

    it('7: non-reviewer role (INTERN) cannot view verification (403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-1/verification',
        headers: {
          authorization: 'Bearer INTERN:intern-someone',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('8: reviewer without ownership/hierarchy access cannot view verification (403)', async () => {
      repo.getProof.mockResolvedValueOnce(mockVerifiedProof);
      checkHierarchyAccess.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-1/verification',
        headers: {
          authorization: 'Bearer TL:foreign-tl',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toContain('Forbidden');
    });

    it('ADMIN can view verification without hierarchy check', async () => {
      repo.getProof.mockResolvedValueOnce(mockVerifiedProof);

      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/proof-view-1/verification',
        headers: {
          authorization: 'Bearer ADMIN:admin-user',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(checkHierarchyAccess).not.toHaveBeenCalled();
    });

    it('returns 404 if proof is not found', async () => {
      repo.getProof.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/proofs/non-existent-proof/verification',
        headers: {
          authorization: 'Bearer ADMIN:admin-user',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Reviewer "Verify Now" Endpoint & RBAC', () => {
    const mockProofToVerify = {
      id: 'proof-trigger-1',
      task_id: 'task-001',
      intern_id: 'intern-target',
      status: 'PENDING',
    };

    const mockTask = {
      id: 'task-001',
      task_link: 'https://twitter.com/test/status/999',
    };

    it('10: authorized reviewer can trigger verification via POST /api/proofs/:id/ai-verify and returns 202', async () => {
      repo.getProof.mockResolvedValueOnce(mockProofToVerify);
      checkHierarchyAccess.mockResolvedValueOnce(true);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);

      const enqueueSpy = jest.spyOn(
        verificationService,
        'enqueueProofVerification'
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
        headers: {
          authorization: 'Bearer TL:reviewer-tl',
        },
      });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.status).toBe('verification_started');
      expect(body.advisory).toBe(true);
      expect(enqueueSpy).toHaveBeenCalledWith('proof-trigger-1', {
        reviewer: expect.objectContaining({ id: 'reviewer-tl', role: 'TL' }),
      });
    });

    it('10: authorized reviewer can trigger verification via POST /api/proofs/:id/verify-now alias', async () => {
      repo.getProof.mockResolvedValueOnce(mockProofToVerify);
      checkHierarchyAccess.mockResolvedValueOnce(true);
      socialTasksRepo.getTaskById.mockResolvedValueOnce(mockTask);

      const enqueueSpy = jest.spyOn(
        verificationService,
        'enqueueProofVerification'
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/verify-now',
        headers: {
          authorization: 'Bearer SENIOR_TL:senior-tl',
        },
      });

      expect(res.statusCode).toBe(202);
      expect(enqueueSpy).toHaveBeenCalled();
    });

    it('11: unauthorized user (no token) cannot trigger verification (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
      });

      expect(res.statusCode).toBe(401);
    });

    it('11: unauthorized user (INTERN role) cannot trigger verification (403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
        headers: {
          authorization: 'Bearer INTERN:intern-user',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('prevents self-verification: reviewer cannot verify own submission (403)', async () => {
      repo.getProof.mockResolvedValueOnce({
        ...mockProofToVerify,
        intern_id: 'captain-1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
        headers: {
          authorization: 'Bearer CAPTAIN:captain-1',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toContain(
        'cannot verify your own proof'
      );
    });

    it('reviewer without hierarchy access cannot trigger verification (403)', async () => {
      repo.getProof.mockResolvedValueOnce(mockProofToVerify);
      checkHierarchyAccess.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
        headers: {
          authorization: 'Bearer TL:other-tl',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toContain('Forbidden');
    });

    it('returns 400 when task does not have a task_link', async () => {
      repo.getProof.mockResolvedValueOnce(mockProofToVerify);
      checkHierarchyAccess.mockResolvedValueOnce(true);
      socialTasksRepo.getTaskById.mockResolvedValueOnce({
        id: 'task-001',
        task_link: null,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/proofs/proof-trigger-1/ai-verify',
        headers: {
          authorization: 'Bearer TL:reviewer-tl',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain(
        'Task does not have a proof URL'
      );
    });
  });
});
