import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export const pollsDb = {
  async verifyOptionBelongsToPoll(optionId: number, pollId: number) {
    // Check if option exists in the poll's options JSONB array
    const { data: poll } = await supabase
      .from('polls')
      .select('options')
      .eq('id', pollId)
      .single();
    
    if (!poll?.options) return false;
    
    // Check if any option in the array has matching id
    const options = poll.options as any[];
    return options.some(opt => opt.id === optionId);
  },

  async getActivePolls(userId?: string) {
    // Get active polls with options in JSONB
    const { data: polls, error } = await supabase
      .from('polls')
      .select('*')
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });
    
    console.log('📊 Supabase polls query:', { polls, error, count: polls?.length });

    if (!polls) return [];

    // Enhance each poll with vote counts and user voting status
    const pollsWithVoteData = await Promise.all(
      polls.map(async (poll) => {
        // Get total votes for this poll
        const { count: totalVotes } = await supabase
          .from('poll_responses')
          .select('*', { count: 'exact', head: true })
          .eq('poll_id', poll.id);

        // Get options from JSONB and add vote counts
        const options = (poll.options as any[]) || [];
        
        const optionsWithCounts = await Promise.all(
          options.map(async (opt) => {
            const { count: voteCount } = await supabase
              .from('poll_responses')
              .select('*', { count: 'exact', head: true })
              .eq('poll_id', poll.id)
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

    return pollsWithVoteData;
  },

  async getPollWithResults(pollId: number) {
    // Get poll with options from JSONB
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

    // Get options from JSONB and calculate vote counts
    const options = (poll.options as any[]) || [];
    
    const optionsWithCounts = await Promise.all(
      options.map(async (opt) => {
        const { count: voteCount } = await supabase
          .from('poll_responses')
          .select('*', { count: 'exact', head: true })
          .eq('poll_id', pollId)
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
    // Convert options to JSONB format with IDs
    const optionsWithIds = options.map((opt, index) => ({
      id: index + 1, // Simple incrementing IDs
      label: opt.label || opt,
      description: opt.description || null,
      orderIndex: index
    }));

    // Insert poll with options as JSONB
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
        options: optionsWithIds, // Store as JSONB
        expires_at: pollData.expiresAt,
        created_by: pollData.createdBy
      })
      .select()
      .single();

    if (error || !poll) {
      throw new Error('Failed to create poll');
    }

    return poll.id;
  },

  async updatePollStatus(pollId: number, status: string) {
    await supabase
      .from('polls')
      .update({ status })
      .eq('id', pollId);
  }
};
