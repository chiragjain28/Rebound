import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { generateAIReview } from '../services/aiReview.service';

const router = Router();

const DEFAULT_GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4';
const DEFAULT_MANAGER_WHATSAPP = process.env.MANAGER_WHATSAPP || '919876543210';

// 1. Public Configuration for the QR Review page
router.get('/config', async (_req: Request, res: Response) => {
  try {
    return res.json({
      clubName: 'Rebound Snooker & Pool Club',
      tagline: 'Rate Your Frame & Get Hooked Up!',
      googleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
      managerWhatsApp: DEFAULT_MANAGER_WHATSAPP,
      presetTags: [
        'Smooth Cloth 🎱',
        'Straight Cues 🎯',
        'Iced Cold Coffee ☕',
        'Chilled AC ❄️',
        'Banging Music 🎶',
        'Friendly Staff 🤝',
        'Clean & Aesthetic ✨',
        'PS4 Gaming 🎮'
      ],
      questions: [
        {
          id: 'tables',
          icon: '🎱',
          label: 'Snooker & Pool Tables',
          desc: 'Cloth speed, cushion bounce & cue condition'
        },
        {
          id: 'vibe',
          icon: '🎶',
          label: 'Music & Vibe',
          desc: 'Lighting, playlist energy & lounge atmosphere'
        },
        {
          id: 'food',
          icon: '☕',
          label: 'Cafe & Drinks',
          desc: 'Cold coffee, refreshments & snacks'
        },
        {
          id: 'overall',
          icon: '⚡',
          label: 'Overall Experience',
          desc: 'How much fun did you have at Rebound?'
        }
      ]
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch review config' });
  }
});

// 2. Submit Ratings -> AI Review Generation OR Negative Review Shield
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      customerName = '',
      customerPhone = '',
      customerEmail = '',
      ratings = { overall: 5 },
      tags = [],
      customNote = ''
    } = req.body;

    const overallScore = Number(ratings.overall) || 5;
    const tablesScore = ratings.tables ? Number(ratings.tables) : overallScore;
    const vibeScore = ratings.vibe ? Number(ratings.vibe) : overallScore;
    const foodScore = ratings.food ? Number(ratings.food) : overallScore;
    const staffScore = ratings.staff ? Number(ratings.staff) : overallScore;

    // Calculate weighted average
    const avgScore = (overallScore * 2 + tablesScore + vibeScore + foodScore) / 5;
    const isPositive = avgScore >= 3.8;
    const sentiment = isPositive ? 'positive' : 'negative';

    let reviewText = '';

    if (isPositive) {
      // Generate AI review for Google Maps
      reviewText = await generateAIReview({
        customerName: customerName.trim(),
        ratings: {
          overall: overallScore,
          tables: tablesScore,
          vibe: vibeScore,
          food: foodScore,
          staff: staffScore
        },
        tags,
        customNote: customNote.trim()
      });
    }

    // Save feedback to database for audit & CRM
    const feedback = await (prisma as any).customerFeedback.create({
      data: {
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        ratingOverall: overallScore,
        ratingTables: tablesScore,
        ratingVibe: vibeScore,
        ratingFood: foodScore,
        ratingStaff: staffScore,
        tags: Array.isArray(tags) ? tags.join(', ') : '',
        sentiment,
        generatedReview: reviewText || null,
        postedToGoogle: false
      }
    });

    // If phone number provided, we can also ensure customer is recognized in CRM
    if (customerPhone.trim().length >= 10) {
      try {
        const cleanPhone = customerPhone.trim().slice(-10);
        const existingCustomer = await prisma.customer.findUnique({
          where: { phone: cleanPhone }
        });
        if (!existingCustomer && customerName.trim()) {
          const nameTokens = customerName.trim().split(/\s+/);
          const firstName = nameTokens[0] || 'Guest';
          const lastName = nameTokens.slice(1).join(' ') || '';
          await prisma.customer.create({
            data: {
              phone: cleanPhone,
              firstName,
              lastName,
              name: customerName.trim()
            }
          });
        }
      } catch (crmErr) {
        // Non-blocking CRM upsert
        console.warn('CRM sync note on review:', crmErr);
      }
    }

    return res.json({
      success: true,
      feedbackId: feedback.id,
      sentiment,
      isPositive,
      avgScore: Math.round(avgScore * 10) / 10,
      reviewText,
      googleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
      managerWhatsApp: DEFAULT_MANAGER_WHATSAPP
    });
  } catch (error: any) {
    console.error('Error generating review:', error);
    return res.status(500).json({ error: error.message || 'Failed to process review' });
  }
});

// 3. Negative Feedback Private Complaint Submission (Shielding Google)
router.post('/submit-complaint', async (req: Request, res: Response) => {
  try {
    const { feedbackId, privateFeedback = '', customerPhone = '', customerName = '' } = req.body;

    if (feedbackId) {
      await (prisma as any).customerFeedback.update({
        where: { id: Number(feedbackId) },
        data: {
          privateFeedback: privateFeedback.trim(),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined
        }
      });
    }

    return res.json({
      success: true,
      message: 'Your feedback has been delivered directly to management. Thank you for helping us improve!'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to record complaint' });
  }
});

// 4. Mark review copied to Google
router.post('/mark-copied', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.body;
    if (feedbackId) {
      await (prisma as any).customerFeedback.update({
        where: { id: Number(feedbackId) },
        data: { postedToGoogle: true }
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to mark copied' });
  }
});

// 5. Admin View: Get all customer feedbacks & stats
router.get('/admin/feedbacks', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const feedbacks = await (prisma as any).customerFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const totalCount = feedbacks.length;
    const positiveCount = feedbacks.filter((f: any) => f.sentiment === 'positive').length;
    const negativeCount = feedbacks.filter((f: any) => f.sentiment === 'negative').length;
    const postedCount = feedbacks.filter((f: any) => f.postedToGoogle).length;

    const avgOverall = totalCount > 0
      ? (feedbacks.reduce((sum: number, f: any) => sum + f.ratingOverall, 0) / totalCount).toFixed(1)
      : '5.0';

    return res.json({
      feedbacks,
      stats: {
        totalCount,
        positiveCount,
        negativeCount,
        postedCount,
        avgOverall
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin feedback logs' });
  }
});

export default router;
