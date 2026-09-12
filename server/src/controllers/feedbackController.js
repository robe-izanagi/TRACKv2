const { v4: uuidv4 } = require('uuid');
const { UserFeedback } = require('../models');

const STOPWORDS = new Set([
  'the','a','an','is','it','of','to','and','in','on','for','with','this','that',
  'was','were','are','be','been','has','have','had','i','my','me','we','our',
  'you','your','but','so','very','too','not','no','yes','can','could','would',
  'should','will','just','still','also','more','most','some','any','all',
  'app','system','track','use','used','using','really','than','then','when',
  'what','how','do','does','did','if','or','as','at','by','from','they','their'
]);

const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

// ─── USER: Submit feedback (anonymous — no user_id stored) ──
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!['good', 'neutral', 'not_good'].includes(rating)) {
      return res.status(400).json({ ok: false, message: 'Invalid rating value.' });
    }

    await UserFeedback.create({
      id: uuidv4(),
      rating,
      comment: comment && comment.trim() ? comment.trim() : null,
    });

    res.status(201).json({ ok: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── ADMIN: Rating summary ───────────────────────────
exports.getFeedbackSummary = async (req, res) => {
  try {
    const all = await UserFeedback.findAll({ attributes: ['rating'] });
    const summary = { good: 0, neutral: 0, not_good: 0, total: all.length };
    all.forEach((f) => { summary[f.rating] = (summary[f.rating] || 0) + 1; });
    res.json({ ok: true, summary });
  } catch (error) {
    console.error('Get feedback summary error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── ADMIN: Text mining — keyword & phrase frequency, per rating ──
exports.getTextMining = async (req, res) => {
  try {
    const feedbacks = await UserFeedback.findAll({
      where: { comment: { [require('sequelize').Op.ne]: null } },
      attributes: ['rating', 'comment'],
    });

    const wordCounts = {};       // word -> total count
    const wordByRating = {};     // word -> { good, neutral, not_good }
    const phraseCounts = {};     // bigram -> total count

    for (const f of feedbacks) {
      const words = tokenize(f.comment);
      const seenInThisComment = new Set();

      words.forEach((w) => {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
        if (!wordByRating[w]) wordByRating[w] = { good: 0, neutral: 0, not_good: 0 };
        if (!seenInThisComment.has(w)) {
          wordByRating[w][f.rating]++;
          seenInThisComment.add(w);
        }
      });

      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        phraseCounts[bigram] = (phraseCounts[bigram] || 0) + 1;
      }
    }

    const keywords = Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count, ratings: wordByRating[word] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const phrases = Object.entries(phraseCounts)
      .filter(([, count]) => count >= 2)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.json({ ok: true, keywords, phrases, totalCommentsAnalyzed: feedbacks.length });
  } catch (error) {
    console.error('Get text mining error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── ADMIN: Raw feedback list (filterable, no identity shown) ──
exports.listFeedback = async (req, res) => {
  try {
    const { rating } = req.query;
    const where = {};
    if (rating && rating !== 'all' && ['good', 'neutral', 'not_good'].includes(rating)) {
      where.rating = rating;
    }

    const items = await UserFeedback.findAll({
      where,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'rating', 'comment', 'created_at'],
    });

    res.json({ ok: true, feedback: items });
  } catch (error) {
    console.error('List feedback error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};