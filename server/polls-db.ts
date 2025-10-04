import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export const pollsDb = {
  async verifyOptionBelongsToPoll(optionId: number, pollId: number) {
    const [option] = await sql`
      SELECT poll_id FROM poll_options
      WHERE id = ${optionId}
    `;
    return option && option.poll_id === pollId;
  },

  async getActivePolls(userId?: string) {
    const polls = await sql`
      SELECT p.*, 
        (SELECT COUNT(*)::integer FROM poll_responses WHERE poll_id = p.id) as total_votes
      FROM polls p
      WHERE p.status = 'active'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY p.created_at DESC
    `;

    // Get options for each poll
    const pollsWithOptions = await Promise.all(
      polls.map(async (poll) => {
        const options = await sql`
          SELECT po.*,
            (SELECT COUNT(*)::integer FROM poll_responses WHERE option_id = po.id) as vote_count
          FROM poll_options po
          WHERE po.poll_id = ${poll.id}
          ORDER BY po.order_index ASC
        `;

        // Check if user has voted on this poll
        let userHasVoted = false;
        if (userId) {
          const [response] = await sql`
            SELECT id FROM poll_responses
            WHERE poll_id = ${poll.id} AND user_id = ${userId}
            LIMIT 1
          `;
          userHasVoted = !!response;
        }

        return {
          ...poll,
          user_has_voted: userHasVoted,
          options: options.map(opt => ({
            ...opt,
            percentage: poll.total_votes > 0 
              ? Math.round((opt.vote_count / poll.total_votes) * 100) 
              : 0
          }))
        };
      })
    );

    return pollsWithOptions;
  },

  async getPollWithResults(pollId: number) {
    const [poll] = await sql`
      SELECT p.*, 
        (SELECT COUNT(*)::integer FROM poll_responses WHERE poll_id = p.id) as total_votes
      FROM polls p
      WHERE p.id = ${pollId}
    `;

    if (!poll) {
      throw new Error('Poll not found');
    }

    const options = await sql`
      SELECT po.*,
        (SELECT COUNT(*)::integer FROM poll_responses WHERE option_id = po.id) as vote_count
      FROM poll_options po
      WHERE po.poll_id = ${pollId}
      ORDER BY po.order_index ASC
    `;

    return {
      ...poll,
      options: options.map(opt => ({
        ...opt,
        percentage: poll.total_votes > 0 
          ? Math.round((opt.vote_count / poll.total_votes) * 100) 
          : 0
      }))
    };
  },

  async getUserPollResponse(pollId: number, userId: string) {
    const [response] = await sql`
      SELECT * FROM poll_responses
      WHERE poll_id = ${pollId} AND user_id = ${userId}
      LIMIT 1
    `;
    return response;
  },

  async createPollResponse(response: { pollId: number; optionId: number; userId: string }) {
    await sql`
      INSERT INTO poll_responses (poll_id, option_id, user_id, created_at)
      VALUES (${response.pollId}, ${response.optionId}, ${response.userId}, NOW())
    `;
  },

  async createPoll(pollData: any, options: any[]) {
    const [poll] = await sql`
      INSERT INTO polls (
        question, type, sponsor_name, sponsor_logo_url, sponsor_cta_url,
        status, points_reward, expires_at, created_by, created_at, updated_at
      )
      VALUES (
        ${pollData.question}, ${pollData.type}, ${pollData.sponsorName}, 
        ${pollData.sponsorLogoUrl}, ${pollData.sponsorCtaUrl},
        ${pollData.status}, ${pollData.pointsReward}, ${pollData.expiresAt}, 
        ${pollData.createdBy}, NOW(), NOW()
      )
      RETURNING id
    `;

    // Insert options
    for (let i = 0; i < options.length; i++) {
      await sql`
        INSERT INTO poll_options (poll_id, label, description, order_index, created_at)
        VALUES (${poll.id}, ${options[i].label || options[i]}, ${options[i].description || null}, ${i}, NOW())
      `;
    }

    return poll.id;
  },

  async updatePollStatus(pollId: number, status: string) {
    await sql`
      UPDATE polls
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${pollId}
    `;
  }
};
