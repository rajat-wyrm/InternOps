const service = require('../../src/modules/ai-performance/service');
const repository = require('../../src/modules/ai-performance/repository');

jest.mock('../../src/modules/ai-performance/repository');

describe('AI Performance Intelligence Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generateReview creates review snapshot for high performer data', async () => {
    const mockData = {
      intern_id: '11111111-1111-1111-1111-111111111111',
      intern_name: 'Test Intern',
      department: 'Engineering',
      review_period_start: '2026-08-01T00:00:00.000Z',
      review_period_end: '2026-08-31T00:00:00.000Z',
      tasks_assigned: 10,
      tasks_completed: 10,
      tasks_late: 0,
      tasks_rejected: 0,
      avg_rating_score: 9.0,
      ratings_count: 5,
      previous_review: null,
    };

    repository.gatherInternPerformanceData.mockResolvedValue(mockData);
    repository.savePerformanceReview.mockImplementation(async (data) => ({
      id: '22222222-2222-2222-2222-222222222222',
      ...data,
      created_at: new Date().toISOString(),
    }));

    const result = await service.generateReview(
      mockData.intern_id,
      'admin-id',
      mockData.review_period_start,
      mockData.review_period_end
    );

    expect(repository.gatherInternPerformanceData).toHaveBeenCalledWith(
      mockData.intern_id,
      mockData.review_period_start,
      mockData.review_period_end
    );
    expect(repository.savePerformanceReview).toHaveBeenCalled();
    expect(result.overall_score).toBeGreaterThanOrEqual(70);
    expect(result.performance_level).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  test('generateReview handles zero/insufficient data gracefully', async () => {
    const mockZeroData = {
      intern_id: '33333333-3333-3333-3333-333333333333',
      intern_name: 'Empty Intern',
      department: 'QA',
      review_period_start: '2026-08-01T00:00:00.000Z',
      review_period_end: '2026-08-31T00:00:00.000Z',
      tasks_assigned: 0,
      tasks_completed: 0,
      ratings_count: 0,
      previous_review: null,
    };

    repository.gatherInternPerformanceData.mockResolvedValue(mockZeroData);
    repository.savePerformanceReview.mockImplementation(async (data) => ({
      id: '44444444-4444-4444-4444-444444444444',
      ...data,
    }));

    const result = await service.generateReview(
      mockZeroData.intern_id,
      'admin-id',
      mockZeroData.review_period_start,
      mockZeroData.review_period_end
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.overall_score).toBe(0);
    expect(result.performance_level).toBe('Insufficient Data');
  });
});
