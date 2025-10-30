import { supabase } from './supabase';

class SessionTracker {
  private sessionId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;

  async startSession(userId: string) {
    if (this.sessionId && this.userId === userId) {
      // Session already active for this user
      return;
    }

    // End previous session if exists
    if (this.sessionId) {
      await this.endSession();
    }

    this.userId = userId;
    this.sessionId = crypto.randomUUID();

    try {
      // Create session in database
      const { error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_id: this.sessionId,
          started_at: new Date().toISOString(),
          client_metadata: {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
          },
        });

      if (error) {
        console.error('Failed to start session:', error);
        return;
      }

      console.log('📊 Session started:', this.sessionId);

      // Start heartbeat (every 30 seconds)
      this.startHeartbeat();

      // Listen for visibility changes and page unload
      window.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  }

  private startHeartbeat() {
    // Clear existing heartbeat if any
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  private async sendHeartbeat() {
    if (!this.sessionId || !this.userId) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_heartbeat: new Date().toISOString(),
        })
        .eq('session_id', this.sessionId)
        .eq('user_id', this.userId);

      if (error) {
        console.error('Failed to send heartbeat:', error);
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  async endSession() {
    if (!this.sessionId || !this.userId) return;

    try {
      // Update session with end time
      const { error } = await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
        })
        .eq('session_id', this.sessionId)
        .eq('user_id', this.userId);

      if (error) {
        console.error('Failed to end session:', error);
      }

      console.log('📊 Session ended:', this.sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      // Clear heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Remove event listeners
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);

      this.sessionId = null;
      this.userId = null;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && this.sessionId && this.userId) {
      // Send final heartbeat when page becomes hidden
      // This catches most tab closes/navigations
      this.sendHeartbeat();
    }
  };

  private handleBeforeUnload = () => {
    // Send final heartbeat on page unload
    // The session will be marked as ended based on last_heartbeat
    if (this.sessionId && this.userId) {
      this.sendHeartbeat();
    }
  };
}

// Export singleton instance
export const sessionTracker = new SessionTracker();
