import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export const pollsDb = {
  async verifyOptionBelongsToPoll(optionId: number, pollId: number) {
    const { data: option } = await supabase
      .from('poll_options')
      .select('poll_id')
      .eq('id', optionId)
      .single();
    
    return option && option.poll_id === pollId;
  },

  async getActivePolls(userId?: string) {
    // Get active polls
    const { data: polls } = await supabase
      .from('polls')
      .select('*')
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });

    if (!polls) return [];

    // Get options and vote counts for each poll
    const pollsWithOptions = await Promise.all(
      polls.map(async (poll) => {
        // Get options with vote counts
        const { data: options } = await supabase
          .from('poll_options')
          .select('*')
          .eq('poll_id', poll.id)
          .order('order_index', { ascending: true });

        // Get total votes for this poll
        const { count: totalVotes } = await supabase
          .from('poll_responses')
          .select('*', { count: 'exact', head: true })
          .eq('poll_id', poll.id);

        // Get vote count for each option
        const optionsWithCounts = await Promise.all(
          (options || []).map(async (opt) => {
            const { count: voteCount } = await supabase
              .from('poll_responses')
              .select('*', { count: 'exact', head: true })
              .eq('option_id', opt.id);

            return {
              ...opt,
              vote_count: voteCount || 0,
              percentage: totalVotes && totalVotes > 0
                ? Math.round(((voteCount || 0) / totalVotes) * 100)
                : 0
            };
          })
        );

        // Check if user has voted
        let userHasVoted = false;
        if (userId) {
          const { data: response } = await supabase
            .from('poll_responses')
            .select('id')
            .eq('poll_id', poll.id)
            .eq('user_id', userId)
            .limit(1)
            .single();
          
          userHasVoted = !!response;
        }

        return {
          ...poll,
          total_votes: totalVotes || 0,
          user_has_voted: userHasVoted,
          options: optionsWithCounts
        };
      })
    );

    return pollsWithOptions;
  },

  async getPollWithResults(pollId: number) {
    // Get poll
    const { data: poll } = await supabase
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Get total votes
    const { count: totalVotes } = await supabase
      .from('poll_responses')
      .select('*', { count: 'exact', head: true })
      .eq('poll_id', pollId);

    // Get options with vote counts
    const { data: options } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('order_index', { ascending: true });

    const optionsWithCounts = await Promise.all(
      (options || []).map(async (opt) => {
        const { count: voteCount } = await supabase
          .from('poll_responses')
          .select('*', { count: 'exact', head: true })
          .eq('option_id', opt.id);

        return {
          ...opt,
          vote_count: voteCount || 0,
          percentage: totalVotes && totalVotes > 0
            ? Math.round(((voteCount || 0) / totalVotes) * 100)
            : 0
        };
      })
    );

    return {
      ...poll,
      total_votes: totalVotes || 0,
      options: optionsWithCounts
    };
  },

  async getUserPollResponse(pollId: number, userId: string) {
    const { data: response } = await supabase
      .from('poll_responses')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    return response;
  },

  async createPollResponse(response: { pollId: number; optionId: number; userId: string }) {
    await supabase
      .from('poll_responses')
      .insert({
        poll_id: response.pollId,
        option_id: response.optionId,
        user_id: response.userId
      });
  },

  async createPoll(pollData: any, options: any[]) {
    // Insert poll
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        question: pollData.question,
        type: pollData.type,
        sponsor_name: pollData.sponsorName,
        sponsor_logo_url: pollData.sponsorLogoUrl,
        sponsor_cta_url: pollData.sponsorCtaUrl,
        status: pollData.status,
        points_reward: pollData.pointsReward,
        expires_at: pollData.expiresAt,
        created_by: pollData.createdBy
      })
      .select()
      .single();

    if (error || !poll) {
      throw new Error('Failed to create poll');
    }

    // Insert options
    const optionsData = options.map((opt, index) => ({
      poll_id: poll.id,
      label: opt.label || opt,
      description: opt.description || null,
      order_index: index
    }));

    await supabase
      .from('poll_options')
      .insert(optionsData);

    return poll.id;
  },

  async updatePollStatus(pollId: number, status: string) {
    await supabase
      .from('polls')
      .update({ status })
      .eq('id', pollId);
  }
};
