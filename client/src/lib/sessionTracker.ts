import { supabase } from './supabase';

interface PageView {
  page: string;
  enteredAt: number;
  scrollDepth: number;
}

class SessionTracker {
  private sessionId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;
  private currentPage: PageView | null = null;
  private pageViews: Array<{ page: string; duration: number; scrollDepth: number }> = [];
  private scrollHandler: (() => void) | null = null;

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

    // Send heartbeat with page views every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeatWithPageViews();
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
      // First, flush all page views before ending session
      this.finishCurrentPage();
      const allPageViews = [...this.pageViews];
      
      // Update session with end time and final page views
      const { error } = await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          page_views: allPageViews.length > 0 ? allPageViews : undefined,
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

      // Remove scroll listener
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler);
        this.scrollHandler = null;
      }

      // Remove event listeners
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);

      // Clear state
      this.sessionId = null;
      this.userId = null;
      this.currentPage = null;
      this.pageViews = [];
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && this.sessionId && this.userId) {
      // Send final heartbeat with page views when page becomes hidden
      // This catches most tab closes/navigations
      this.sendHeartbeatWithPageViews();
    }
  };

  private handleBeforeUnload = () => {
    // Send final heartbeat with page views on page unload
    // The session will be marked as ended based on last_heartbeat
    if (this.sessionId && this.userId) {
      this.sendHeartbeatWithPageViews();
    }
  };

  // Track when user navigates to a new page
  trackPageView(page: string) {
    if (!this.sessionId || !this.userId) return;

    // Finish tracking the previous page
    this.finishCurrentPage();

    // Start tracking new page
    this.currentPage = {
      page,
      enteredAt: Date.now(),
      scrollDepth: 0,
    };

    // Track scroll depth
    this.setupScrollTracking();

    console.log('📊 Page view:', page);
  }

  private finishCurrentPage() {
    // Remove scroll listener first
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.currentPage) {
      const duration = Math.round((Date.now() - this.currentPage.enteredAt) / 1000);
      
      // Only track if user spent at least 1 second on page
      if (duration >= 1) {
        this.pageViews.push({
          page: this.currentPage.page,
          duration,
          scrollDepth: this.currentPage.scrollDepth,
        });
      }
      
      this.currentPage = null;
    }
  }

  // Capture current page data without clearing it (for heartbeats)
  private captureCurrentPageData(): { page: string; duration: number; scrollDepth: number } | null {
    if (!this.currentPage) return null;
    
    const duration = Math.round((Date.now() - this.currentPage.enteredAt) / 1000);
    if (duration < 1) return null;
    
    return {
      page: this.currentPage.page,
      duration,
      scrollDepth: this.currentPage.scrollDepth,
    };
  }

  private setupScrollTracking() {
    // Remove existing listener if any
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }

    this.scrollHandler = () => {
      if (!this.currentPage) return;
      
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 100;
      
      this.currentPage.scrollDepth = Math.max(this.currentPage.scrollDepth, scrollPercent);
    };

    // Update on scroll (throttled via passive listener)
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  // Track specific user actions/events
  trackEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.sessionId || !this.userId) return;

    // Log event for debugging
    console.log('📊 Event:', eventName, properties);

    // Send event to database asynchronously
    this.sendEvent(eventName, properties);
  }

  private async sendEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.sessionId || !this.userId) return;

    try {
      await supabase
        .from('user_events')
        .insert({
          user_id: this.userId,
          session_id: this.sessionId,
          event_name: eventName,
          properties: properties || {},
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      // Silent fail for events - don't interrupt user experience
      console.error('Failed to send event:', error);
    }
  }

  // Enhanced heartbeat that includes page view data
  // Sends ALL accumulated page views to preserve full session history
  private async sendHeartbeatWithPageViews() {
    if (!this.sessionId || !this.userId) return;

    // Include current page data without finishing it (so we keep tracking)
    const currentPageData = this.captureCurrentPageData();
    
    // Combine all completed page views with current page snapshot
    // This preserves the full history with each heartbeat
    const allPageViews = currentPageData 
      ? [...this.pageViews, currentPageData]
      : [...this.pageViews];

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_heartbeat: new Date().toISOString(),
          page_views: allPageViews.length > 0 ? allPageViews : undefined,
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

  // Check if session is active
  isSessionActive(): boolean {
    return this.sessionId !== null && this.userId !== null;
  }
}

// Export singleton instance
export const sessionTracker = new SessionTracker();
