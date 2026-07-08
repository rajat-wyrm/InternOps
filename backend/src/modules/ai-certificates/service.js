const path = require('path');
const fs = require('fs');

// ============================================================
// Helper: Call Python AI server (using native fetch)
// ============================================================

const PYTHON_SERVER_URL =
  process.env.PYTHON_AI_SERVER_URL || 'http://localhost:8080';

async function callPythonEndpoint(endpoint, data, method = 'POST') {
  const url = `${PYTHON_SERVER_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Python server returned ${response.status}`);
  }
  return response.json();
}

// ============================================================
// Validation (Group 3 functionality)
// ============================================================

async function validateCertificate(data) {
  try {
    const result = await callPythonEndpoint('/api/validate', {
      name: data.name,
      company: data.company,
      achievement: data.achievement,
      date: data.date,
      use_ai: data.use_ai,
    });
    return result;
  } catch (error) {
    // Fallback to basic validation if Python server is not available
    return {
      status: 'success',
      text: `${data.name} from ${data.company} - ${data.achievement}`,
      font_size: 40,
      cleaned: {
        name: data.name,
        company: data.company,
        achievement: data.achievement,
        date: data.date,
      },
    };
  }
}

// ============================================================
// Text Generation (Group 1 functionality)
// ============================================================

async function generateAchievementStatement(data) {
  try {
    const result = await callPythonEndpoint('/api/generate-text', {
      recipient_name: data.recipient_name,
      recognition_type: data.recognition_type,
      core_achievement: data.core_achievement,
      desired_tone: data.desired_tone,
    });
    return result;
  } catch (error) {
    // Fallback to AI provider service
    const aiProvider = require('../../services/aiProviderService');

    const prompt = `Generate a professional achievement statement for:
Recipient: ${data.recipient_name}
Recognition Type: ${data.recognition_type}
Achievement: ${data.core_achievement}
Tone: ${data.desired_tone}

Provide a concise, professional achievement statement (2-3 sentences).`;

    try {
      const result = await aiProvider.generate(prompt);
      return { status: 'success', statement: result };
    } catch (aiError) {
      return {
        status: 'success',
        statement: `This certificate is awarded to ${data.recipient_name} in recognition of their outstanding ${data.core_achievement}.`,
      };
    }
  }
}

async function generateContent(data) {
  try {
    const result = await callPythonEndpoint('/api/generate-content', {
      prompt: data.prompt,
      tone: data.tone,
      content_type: data.content_type,
    });
    return result;
  } catch (error) {
    // Fallback to AI provider service
    const aiProvider = require('../../services/aiProviderService');

    const prompt = `Generate ${data.content_type} content with ${data.tone} tone:
${data.prompt}

Provide well-structured content appropriate for a certificate.`;

    try {
      const result = await aiProvider.generate(prompt);
      return { status: 'success', generated_text: result };
    } catch (aiError) {
      return {
        status: 'success',
        generated_text: `This is a professional ${data.content_type} with a ${data.tone} tone.`,
      };
    }
  }
}

// ============================================================
// Template Matching (Group 2 functionality)
// ============================================================

async function matchTemplate(data) {
  try {
    const result = await callPythonEndpoint('/api/match-template', {
      certificate_type: data.certificate_type,
      tone: data.tone,
      industry: data.industry,
      style: data.style,
      audience: data.audience,
      language: data.language,
      user_text: data.user_text,
    });
    return result;
  } catch (error) {
    // Fallback to AI provider service
    const aiProvider = require('../../services/aiProviderService');
    const repo = require('../certificates/repository');

    const templates = await repo.getTemplates({ limit: 10 });
    const templateNames = templates.map((t) => t.name).join(', ');

    const prompt = `Given a ${data.certificate_type} certificate with ${data.style} style for ${data.industry} industry:
Available templates: ${templateNames}

Which template would be most appropriate? Return just the template name.`;

    try {
      const result = await aiProvider.generate(prompt);
      const matched = templates.find((t) => result.includes(t.name));
      return {
        best_match: matched || templates[0],
        top_3: templates.slice(0, 3),
      };
    } catch (aiError) {
      return {
        best_match: templates[0],
        top_3: templates.slice(0, 3),
      };
    }
  }
}

// ============================================================
// Certificate Rendering (Group 2 functionality)
// ============================================================

async function renderCertificatePNG(data) {
  try {
    const result = await callPythonEndpoint(
      `/api/certificate-png?name=${encodeURIComponent(data.name)}&task=${encodeURIComponent(data.task)}`,
      {},
      'GET'
    );
    return result;
  } catch (error) {
    // Fallback to PDF generation
    const { generateCertificatePDF } = require('../certificates/pdf');
    const { generateQRCodeDataURL } = require('../certificates/qr');

    const pdfBuffer = await generateCertificatePDF(
      {
        recipientName: data.name,
        title: data.task,
        body: `This is to certify that ${data.name} has successfully completed ${data.task}`,
        issuer: 'InternOps',
        issueDate: new Date().toISOString().slice(0, 10),
        certificateType: data.task,
      },
      {}
    );

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify/certificate`;
    const qrCodeUrl = await generateQRCodeDataURL(verifyUrl);

    const filename = `cert_ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'certificates',
      filename
    );

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFileSync(filePath, pdfBuffer);

    return {
      type: 'pdf',
      filename,
      path: `/uploads/certificates/${filename}`,
      qr_code: qrCodeUrl,
    };
  }
}

// ============================================================
// Full Pipeline (All Groups combined)
// ============================================================

async function runFullPipeline(data) {
  try {
    const result = await callPythonEndpoint('/api/pipeline', {
      name: data.name,
      company: data.company,
      achievement: data.achievement,
      date: data.date,
      tone: data.tone,
      certificate_type: data.certificate_type,
      industry: data.industry,
      style: data.style,
      audience: data.audience,
      language: data.language,
      use_ai_beautify: data.use_ai_beautify,
    });
    return result;
  } catch (error) {
    // Fallback to step-by-step processing
    const validation = await validateCertificate({
      name: data.name,
      company: data.company,
      achievement: data.achievement,
      date: data.date,
      use_ai: data.use_ai_beautify,
    });

    const achievement = await generateAchievementStatement({
      recipient_name: data.name,
      recognition_type: data.certificate_type,
      core_achievement: data.achievement,
      desired_tone: data.tone,
    });

    const templateMatch = await matchTemplate({
      certificate_type: data.certificate_type,
      tone: data.tone,
      industry: data.industry,
      style: data.style,
      audience: data.audience,
      language: data.language,
      user_text: achievement.statement,
    });

    return {
      status: 'success',
      steps: {
        validation,
        achievement_statement: achievement.statement,
        template_match: templateMatch,
      },
      summary: {
        name: data.name,
        company: data.company,
        date: data.date,
        certificate_text: validation.text || '',
        achievement_statement: achievement.statement,
        recommended_template: templateMatch.best_match?.name || 'Default',
      },
    };
  }
}

// ============================================================
// Bulk AI Generation
// ============================================================

async function startBulkAIGeneration(data, userId) {
  const repo = require('../certificates/repository');

  const job = await repo.createBulkJob(
    {
      template_id: data.template_id,
      total_count: data.certificates.length,
      send_email: data.send_email,
      email_subject: data.email_subject,
      email_body: data.email_body,
    },
    userId
  );

  const results = { generated: 0, failed: 0, errors: [] };

  for (const certData of data.certificates) {
    try {
      // Generate AI content for each certificate
      const aiContent = await generateAchievementStatement({
        recipient_name: certData.recipient_name,
        recognition_type: certData.certificate_type || 'achievement',
        core_achievement: certData.achievement || 'Outstanding performance',
        desired_tone: certData.tone || 'Professional',
      });

      const cert = await require('../certificates/service').generateCertificate(
        {
          template_id: data.template_id,
          recipient_name: certData.recipient_name,
          recipient_email: certData.recipient_email,
          title: certData.title || 'Certificate of Achievement',
          body: aiContent.statement,
          issuer: certData.issuer,
          certificate_type: certData.certificate_type || 'achievement',
          metadata: {
            ...certData.metadata,
            ai_generated: true,
            ai_statement: aiContent.statement,
          },
        },
        userId
      );

      await repo.createBulkJobItem({
        bulk_job_id: job.id,
        certificate_id: cert.data.id,
        recipient_name: certData.recipient_name,
        recipient_email: certData.recipient_email,
        row_data: certData,
        status: 'generated',
      });

      results.generated++;
    } catch (err) {
      await repo.createBulkJobItem({
        bulk_job_id: job.id,
        recipient_name: certData.recipient_name,
        recipient_email: certData.recipient_email,
        row_data: certData,
        status: 'failed',
        error_message: err.message,
      });

      results.failed++;
      results.errors.push({
        recipient: certData.recipient_name,
        error: err.message,
      });
    }
  }

  await repo.updateBulkJob(job.id, {
    status: 'completed',
    completed_count: results.generated,
    failed_count: results.failed,
    error_log: results.errors,
    completed_at: new Date().toISOString(),
  });

  return {
    job_id: job.id,
    total: data.certificates.length,
    generated: results.generated,
    failed: results.failed,
    errors: results.errors,
  };
}

async function getBulkAIJobStatus(id) {
  const repo = require('../certificates/repository');
  const job = await repo.getBulkJobById(id);
  if (!job) return null;
  const items = await repo.getBulkJobItems(id);
  return { ...job, items };
}

// ============================================================
// Tone Customizer (from toneCustomizer.js)
// ============================================================

const AVAILABLE_TONES = [
  'Professional',
  'Formal',
  'Friendly',
  'Motivational',
  'Casual',
];

async function generateWithTone(data) {
  const aiProvider = require('../../services/aiProviderService');

  const prompt = `You are an expert certificate content writer for SyncAura.
Generate certificate text for:
- Certificate Type: ${data.certificate_type}
- Recipient Name: ${data.recipient_name}
- Company Name: ${data.company_name}
- Achievement: ${data.achievement || 'successfully completed the program'}
- Tone: ${data.tone}
Return ONLY a JSON object with keys: "title", "body", "closing". No extra text.`;

  try {
    const result = await aiProvider.generate(prompt);
    const cleanText = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return { tone: data.tone, ...JSON.parse(cleanText) };
  } catch {
    const fallbacks = {
      Professional: {
        title: `Certificate of ${data.certificate_type || 'Achievement'}`,
        body: `This certificate is proudly presented to ${data.recipient_name} from ${data.company_name} in recognition of ${data.achievement || 'successfully completing the program'}.`,
        closing: 'With professional regards',
      },
      Formal: {
        title: `Official Certificate of ${data.certificate_type || 'Completion'}`,
        body: `We hereby certify that ${data.recipient_name} of ${data.company_name} has demonstrated exceptional performance in ${data.achievement || 'the designated program'}.`,
        closing: 'By official authority',
      },
      Friendly: {
        title: `Way to Go, ${data.recipient_name}!`,
        body: `Huge congrats to ${data.recipient_name} from ${data.company_name} for crushing ${data.achievement || 'the program'}! Your hard work really paid off.`,
        closing: 'Cheers to your success!',
      },
      Motivational: {
        title: `Certificate of Excellence`,
        body: `${data.recipient_name} of ${data.company_name} has proven that dedication and perseverance lead to extraordinary results in ${data.achievement || 'this endeavor'}.`,
        closing: 'Keep reaching for the stars',
      },
      Casual: {
        title: `You Did It!`,
        body: `${data.recipient_name} from ${data.company_name} just wrapped up ${data.achievement || 'the program'} and nailed it. Well done!`,
        closing: 'Nice work!',
      },
    };
    return {
      tone: data.tone,
      ...(fallbacks[data.tone] || fallbacks.Professional),
    };
  }
}

// ============================================================
// Multi-Language Support (from multiLanguageSupport.js)
// ============================================================

const SUPPORTED_LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'French',
  'Spanish',
  'Arabic',
  'German',
  'Japanese',
  'Chinese (Simplified)',
];

async function generateInLanguage(data) {
  const aiProvider = require('../../services/aiProviderService');

  const prompt = `You are an expert multilingual certificate content writer for SyncAura.
Generate certificate text in ${data.language} language for:
- Certificate Type: ${data.certificate_type}
- Recipient Name: ${data.recipient_name} (do NOT translate the name)
- Company Name: ${data.company_name} (do NOT translate the name)
- Achievement: ${data.achievement || 'successfully completed the program'}
Return ONLY a JSON object with keys: "title", "body", "closing", "language". No extra text.`;

  try {
    const result = await aiProvider.generate(prompt);
    const cleanText = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return { language: data.language, ...JSON.parse(cleanText) };
  } catch {
    return {
      language: data.language,
      title: `Certificate of ${data.certificate_type || 'Achievement'}`,
      body: `This certificate is presented to ${data.recipient_name} from ${data.company_name} for ${data.achievement || 'successfully completing the program'}.`,
      closing: 'Congratulations',
    };
  }
}

// ============================================================
// Design Suggestions (from design_suggestion/app.py)
// ============================================================

function getDesignTemplates() {
  return [
    {
      name: 'Royal Gold',
      emoji: '👑',
      style: 'Formal & Prestigious',
      colors: 'Navy + Gold',
      font: 'Georgia, serif',
      best_for: ['Academic', 'Award', 'Graduation'],
    },
    {
      name: 'Ivory Scroll',
      emoji: '📜',
      style: 'Classic & Timeless',
      colors: 'Ivory + Sepia + Brown',
      font: 'Palatino Linotype, serif',
      best_for: ['Academic', 'Historical', 'Literature'],
    },
    {
      name: 'Oxford Blue',
      emoji: '🎓',
      style: 'University & Academic',
      colors: 'Oxford Blue + Cream + Silver',
      font: 'Book Antiqua, serif',
      best_for: ['Graduation', 'Degree', 'University'],
    },
    {
      name: 'Emerald Honor',
      emoji: '🏅',
      style: 'Honor & Excellence',
      colors: 'Emerald Green + Gold + White',
      font: 'Garamond, serif',
      best_for: ['Honor Roll', 'Excellence', 'Award'],
    },
    {
      name: 'Crimson Prestige',
      emoji: '🎖️',
      style: 'Prestige & Authority',
      colors: 'Crimson + Black + Gold',
      font: 'Times New Roman, serif',
      best_for: ['Award', 'Leadership', 'Excellence'],
    },
    {
      name: 'Modern Minimal',
      emoji: '🏢',
      style: 'Clean & Professional',
      colors: 'White + Charcoal + Blue',
      font: 'Trebuchet MS, sans-serif',
      best_for: ['Corporate', 'Training', 'Internship'],
    },
    {
      name: 'Slate Executive',
      emoji: '💼',
      style: 'Executive & Corporate',
      colors: 'Slate Grey + White + Teal',
      font: 'Verdana, sans-serif',
      best_for: ['Corporate', 'Executive', 'Management'],
    },
    {
      name: 'Carbon Pro',
      emoji: '⚙️',
      style: 'Industrial & Bold',
      colors: 'Carbon Black + Orange + White',
      font: 'Impact, sans-serif',
      best_for: ['Engineering', 'Manufacturing', 'Technical'],
    },
    {
      name: 'Navy Corporate',
      emoji: '🔷',
      style: 'Trustworthy & Professional',
      colors: 'Navy + White + Gold Accent',
      font: 'Calibri, sans-serif',
      best_for: ['Finance', 'Banking', 'Corporate'],
    },
    {
      name: 'Pearl White',
      emoji: '🤍',
      style: 'Ultra-Clean Minimalist',
      colors: 'Pure White + Black + Thin Gray',
      font: 'Century Gothic, sans-serif',
      best_for: ['Professional', 'Corporate', 'Consulting'],
    },
    {
      name: 'Tech Dark',
      emoji: '💻',
      style: 'Futuristic & Bold',
      colors: 'Dark + Cyan + Blue',
      font: 'Courier New, monospace',
      best_for: ['Coding', 'Data Science', 'IT'],
    },
    {
      name: 'Matrix Green',
      emoji: '🟢',
      style: 'Hacker & Tech',
      colors: 'Black + Matrix Green',
      font: 'Lucida Console, monospace',
      best_for: ['Cybersecurity', 'Hacking', 'Programming'],
    },
    {
      name: 'Neon Purple',
      emoji: '🔮',
      style: 'Cyberpunk & Vivid',
      colors: 'Dark Purple + Neon + Pink',
      font: 'Trebuchet MS, sans-serif',
      best_for: ['Gaming', 'Technology', 'Esports'],
    },
    {
      name: 'Circuit Board',
      emoji: '🔌',
      style: 'Engineering & PCB',
      colors: 'PCB Green + Gold Traces',
      font: 'Courier New, monospace',
      best_for: ['Electronics', 'Engineering', 'Hardware'],
    },
    {
      name: 'AI Blue',
      emoji: '🤖',
      style: 'Artificial Intelligence',
      colors: 'Electric Blue + White + Dark',
      font: 'Verdana, sans-serif',
      best_for: ['AI', 'Machine Learning', 'Data Science'],
    },
    {
      name: 'Floral Pastel',
      emoji: '🌸',
      style: 'Elegant & Artistic',
      colors: 'Blush Pink + Lavender + Gold',
      font: 'Palatino Linotype, serif',
      best_for: ['Art', 'Design', 'Music', 'Creative'],
    },
    {
      name: 'Watercolor Blue',
      emoji: '🎨',
      style: 'Artistic & Painterly',
      colors: 'Sky Blue + Soft Teal + White',
      font: 'Garamond, serif',
      best_for: ['Art', 'Design', 'Painting'],
    },
    {
      name: 'Sunset Orange',
      emoji: '🌅',
      style: 'Warm & Vibrant',
      colors: 'Sunset Orange + Deep Red + Cream',
      font: 'Georgia, serif',
      best_for: ['Photography', 'Art', 'Film'],
    },
    {
      name: 'Vintage Sepia',
      emoji: '📷',
      style: 'Retro & Nostalgic',
      colors: 'Sepia + Warm Brown + Cream',
      font: 'Palatino Linotype, serif',
      best_for: ['Photography', 'History', 'Literature'],
    },
    {
      name: 'Art Deco Gold',
      emoji: '✨',
      style: 'Art Deco & Glamour',
      colors: 'Black + Gold + Geometric',
      font: 'Georgia, serif',
      best_for: ['Fashion', 'Design', 'Film', 'Architecture'],
    },
    {
      name: 'Nature Green',
      emoji: '🌿',
      style: 'Warm & Organic',
      colors: 'Forest Green + Cream',
      font: 'Georgia, serif',
      best_for: ['Environment', 'Community', 'Wellness'],
    },
    {
      name: 'Ocean Breeze',
      emoji: '🌊',
      style: 'Coastal & Fresh',
      colors: 'Ocean Blue + Sandy Beige',
      font: 'Trebuchet MS, sans-serif',
      best_for: ['Marine', 'Environment', 'Geography'],
    },
    {
      name: 'Classic Red',
      emoji: '🏆',
      style: 'Bold & Authoritative',
      colors: 'Crimson + White + Gold',
      font: 'Times New Roman, serif',
      best_for: ['Sports', 'Competition', 'Award'],
    },
    {
      name: 'Champion Black',
      emoji: '🥇',
      style: 'Champion & Elite',
      colors: 'Black + Gold + Silver',
      font: 'Impact, sans-serif',
      best_for: ['Sports', 'Champion', 'Competition'],
    },
    {
      name: 'Sports Green',
      emoji: '⚽',
      style: 'Field & Athletic',
      colors: 'Grass Green + White + Black',
      font: 'Trebuchet MS, sans-serif',
      best_for: ['Football', 'Cricket', 'Sports'],
    },
    {
      name: 'Finance Gold',
      emoji: '💰',
      style: 'Wealth & Finance',
      colors: 'Dark + Gold + Forest Green',
      font: 'Garamond, serif',
      best_for: ['Finance', 'Banking', 'Accounting'],
    },
    {
      name: 'MBA Maroon',
      emoji: '📊',
      style: 'Business School',
      colors: 'Maroon + Cream + Gold',
      font: 'Book Antiqua, serif',
      best_for: ['MBA', 'Business', 'Management'],
    },
    {
      name: 'Startup Orange',
      emoji: '🚀',
      style: 'Bold & Disruptive',
      colors: 'Vibrant Orange + Dark + White',
      font: 'Trebuchet MS, sans-serif',
      best_for: ['Startup', 'Entrepreneurship', 'Innovation'],
    },
    {
      name: 'School Spirit',
      emoji: '🏫',
      style: 'School Pride',
      colors: 'Blue + White + Yellow',
      font: 'Georgia, serif',
      best_for: ['School', 'Training', 'Workshop'],
    },
    {
      name: 'Chalkboard',
      emoji: '✏️',
      style: 'Educational & Playful',
      colors: 'Chalkboard Green + White Chalk',
      font: 'Courier New, monospace',
      best_for: ['Education', 'Teaching', 'Workshop'],
    },
    {
      name: 'Medical Blue',
      emoji: '🏥',
      style: 'Clinical & Trusted',
      colors: 'Medical Blue + White + Clean Grey',
      font: 'Verdana, sans-serif',
      best_for: ['Medicine', 'Healthcare', 'Nursing'],
    },
    {
      name: 'Science Lab',
      emoji: '🔬',
      style: 'Scientific & Precise',
      colors: 'Lab White + Deep Blue + Green Signal',
      font: 'Courier New, monospace',
      best_for: ['Chemistry', 'Biology', 'Physics'],
    },
    {
      name: 'Astronomy Dark',
      emoji: '🌌',
      style: 'Cosmic & Deep',
      colors: 'Space Black + Starlight + Deep Purple',
      font: 'Georgia, serif',
      best_for: ['Astronomy', 'Physics', 'Space'],
    },
    {
      name: 'Harvard Crimson',
      emoji: '📖',
      style: 'Ivy League Prestige',
      colors: 'Harvard Crimson + Black + Gold',
      font: 'Garamond, serif',
      best_for: ['Academic', 'Research', 'Degree'],
    },
    {
      name: 'Rose Gold',
      emoji: '💎',
      style: 'Premium & Feminine',
      colors: 'Rose Gold + Blush + Champagne',
      font: 'Georgia, serif',
      best_for: ['Award', 'Excellence', 'Fashion'],
    },
    {
      name: 'Holographic',
      emoji: '🌈',
      style: 'Futuristic & Iridescent',
      colors: 'Holographic Gradient + White',
      font: 'Century Gothic, sans-serif',
      best_for: ['Innovation', 'Technology', 'Design'],
    },
    {
      name: 'Blueprint',
      emoji: '📐',
      style: 'Architectural & Technical',
      colors: 'Blueprint Blue + White Lines',
      font: 'Courier New, monospace',
      best_for: ['Architecture', 'Engineering', 'Design'],
    },
    {
      name: 'Saffron India',
      emoji: '🇮🇳',
      style: 'Vibrant & Cultural',
      colors: 'Saffron + White + India Green',
      font: 'Georgia, serif',
      best_for: ['India', 'Culture', 'Government'],
    },
    {
      name: 'Zen Lotus',
      emoji: '🧘',
      style: 'Calm & Mindful',
      colors: 'Soft Lavender + White + Sage',
      font: 'Garamond, serif',
      best_for: ['Yoga', 'Meditation', 'Wellness'],
    },
    {
      name: 'Jazz Noir',
      emoji: '🎷',
      style: 'Jazz & Cool',
      colors: 'Noir Black + Warm Amber + Cream',
      font: 'Georgia, serif',
      best_for: ['Music', 'Jazz', 'Arts'],
    },
  ];
}

async function suggestDesign(data) {
  const aiProvider = require('../../services/aiProviderService');
  const templates = getDesignTemplates();

  const templateList = templates
    .map(
      (t) =>
        `${t.name} (${t.emoji}) - ${t.style} - Best for: ${t.best_for.join(', ')}`
    )
    .join('\n');

  const prompt = `Given a ${data.certificate_type} certificate for ${data.industry} industry with ${data.style} style and ${data.tone} tone for ${data.audience} audience:

Available templates:
${templateList}

Recommend the top 3 best template matches. For each, explain why it fits.
Return a JSON object with key "recommendations" containing an array of objects with "name", "reason", and "confidence" (high/medium/low).`;

  try {
    const result = await aiProvider.generate(prompt);
    const cleanText = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleanText);
  } catch {
    // Fallback: rule-based matching
    const scored = templates
      .map((t) => {
        let score = 0;
        if (
          t.best_for.some((bf) =>
            bf.toLowerCase().includes(data.industry?.toLowerCase() || '')
          )
        )
          score += 3;
        if (t.style.toLowerCase().includes(data.style?.toLowerCase() || ''))
          score += 2;
        if (
          t.best_for.some((bf) =>
            bf
              .toLowerCase()
              .includes(data.certificate_type?.toLowerCase() || '')
          )
        )
          score += 2;
        return { ...t, score };
      })
      .sort((a, b) => b.score - a.score);

    return {
      recommendations: scored.slice(0, 3).map((t) => ({
        name: t.name,
        emoji: t.emoji,
        style: t.style,
        colors: t.colors,
        font: t.font,
        reason: `Best match for ${data.industry} industry with ${data.style} style`,
        confidence: t.score >= 5 ? 'high' : t.score >= 3 ? 'medium' : 'low',
      })),
    };
  }
}

// ============================================================
// Certificate Preview (HTML rendering)
// ============================================================

function renderCertificatePreview(data) {
  // Escape HTML to prevent XSS attacks (#2)
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const TEMPLATE_STYLES = {
    'Royal Gold': {
      bg: '#0d1b4b',
      fg: '#FFD700',
      border: '8px double #FFD700',
      font: 'Georgia, serif',
    },
    'Ivory Scroll': {
      bg: '#f5f0e8',
      fg: '#3d2b1f',
      border: '6px solid #8b6914',
      font: 'Palatino Linotype, serif',
    },
    'Oxford Blue': {
      bg: '#002147',
      fg: '#f5f0e0',
      border: '6px solid #c0c0c0',
      font: 'Book Antiqua, serif',
    },
    'Modern Minimal': {
      bg: '#ffffff',
      fg: '#212121',
      border: '2px solid #1565c0',
      font: 'Trebuchet MS, sans-serif',
    },
    'Tech Dark': {
      bg: '#0a0e1a',
      fg: '#00e5ff',
      border: '2px solid #00e5ff',
      font: 'Courier New, monospace',
    },
    'AI Blue': {
      bg: '#050d1e',
      fg: '#4fc3f7',
      border: '2px solid #0288d1',
      font: 'Verdana, sans-serif',
    },
    'Floral Pastel': {
      bg: '#fce4ec',
      fg: '#6a1b9a',
      border: '5px solid #ce93d8',
      font: 'Palatino Linotype, serif',
    },
    'Classic Red': {
      bg: '#fff3f3',
      fg: '#b71c1c',
      border: '6px double #c62828',
      font: 'Times New Roman, serif',
    },
    'Harvard Crimson': {
      bg: '#f8f0f0',
      fg: '#1a0000',
      border: '5px solid #a51c30',
      font: 'Garamond, serif',
    },
    'Saffron India': {
      bg: '#fff8e1',
      fg: '#e65100',
      border: '5px solid #ff6f00',
      font: 'Georgia, serif',
    },
  };

  const style =
    TEMPLATE_STYLES[data.template_name] || TEMPLATE_STYLES['Modern Minimal'];

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
  .certificate {
    width: 800px; padding: 60px; background: ${style.bg}; color: ${style.fg};
    border: ${style.border}; font-family: ${style.font}; text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }
  .header { letter-spacing: 6px; font-size: 11px; text-transform: uppercase; margin-bottom: 20px; opacity: 0.7; }
  .title { font-size: 28px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; margin: 20px 0; }
  .name { font-style: italic; font-size: 38px; margin: 30px 0; }
  .body { font-size: 14px; line-height: 1.8; margin: 20px 0; opacity: 0.9; }
  .closing { font-size: 12px; margin-top: 40px; opacity: 0.6; }
  ${data.logo_url ? `.logo { max-width: 100px; margin: 0 auto 20px; }` : ''}
</style>
</head>
<body>
<div class="certificate">
  <div class="header">Certificate of Achievement</div>
  ${data.logo_url ? `<img src="${esc(data.logo_url)}" class="logo" alt="Logo">` : ''}
  <div class="title">${esc(data.title) || 'Certificate of Achievement'}</div>
  <div class="name">${esc(data.recipient_name)}</div>
  <div class="body">${esc(data.body) || 'This certificate is presented in recognition of outstanding performance and achievement.'}</div>
  <div class="closing">${esc(data.closing) || 'Congratulations'}</div>
</div>
</body>
</html>`;

  return { html, template: data.template_name, style };
}

module.exports = {
  validateCertificate,
  generateAchievementStatement,
  generateContent,
  matchTemplate,
  renderCertificatePNG,
  runFullPipeline,
  startBulkAIGeneration,
  getBulkAIJobStatus,
  generateWithTone,
  generateInLanguage,
  getDesignTemplates,
  suggestDesign,
  renderCertificatePreview,
  AVAILABLE_TONES,
  SUPPORTED_LANGUAGES,
};
