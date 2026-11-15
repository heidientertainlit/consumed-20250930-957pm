import { useState } from "react";
import { MoreHorizontal, CornerUpRight, Settings, Flag, Ban } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./_PreviewSheet";
import "./_group.css";
// Name/handle/actions and options sheet extracted from the production profile.
// Auth, identity and all mutations are deliberately stubbed in this preview.
export function ProfileSafetyPreview({ proposed = false, initialMenuOpen = false }: { proposed?: boolean; initialMenuOpen?: boolean }) {
 const [isProfileOptionsOpen,setIsProfileOptionsOpen]=useState(initialMenuOpen);
 const [isBlockConfirmOpen,setIsBlockConfirmOpen]=useState(false);
 const [isReportUserOpen,setIsReportUserOpen]=useState(false);
 const [notice,setNotice]=useState("");
 const isOwnProfile=false;
 const userProfileData:any={first_name:"Jordan",last_name:"Reese",display_name:"Jordan Reese",user_name:"jordanreads",avatar:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23865eb3'/%3E%3Ctext x='40' y='50' text-anchor='middle' font-family='Arial' font-size='30' fill='white'%3EJR%3C/text%3E%3C/svg%3E"};
 const user:any={user_metadata:{}}; const userBadges:any[]=[];
 const setEditUsername=(..._args:any[])=>{};const setEditFirstName=(..._args:any[])=>{};const setEditLastName=(..._args:any[])=>{};const setIsEditProfileOpen=(..._args:any[])=>{};
 const setProfileShareMenuOpen=(..._args:any[])=>setNotice("Sharing stays unchanged in this preview.");
 return <main className="profile-safety-preview min-h-screen bg-[#fbf8f5] pb-6 text-[#30263a]">
 <p className="px-5 pb-4 pt-6 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8b8093]">Other person’s profile · preview only</p>
 <div className="pb-5 pt-4" style={{background:'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)'}}>
 <div className="mx-auto max-w-4xl px-4">
 <div className="relative overflow-hidden rounded-3xl px-6 pt-6 pb-2" style={{background:'linear-gradient(155deg, #2c2150 0%, #181030 100%)',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 10px 40px rgba(124,58,237,0.18)'}}>
 <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full" style={{background:'radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)'}} />
 {/* Name + handle + share */}
            <div className="relative flex items-start justify-between mb-5">
              <div className="flex min-w-0 items-center gap-3">
                {userProfileData?.avatar && (
                  <img
                    src={userProfileData.avatar}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border-2 border-white/20 object-cover shadow-lg"
                  />
                )}
                <div className="min-w-0">
                <h1 className="text-lg font-bold text-white leading-tight truncate">
                  {userProfileData?.first_name && userProfileData?.last_name
                    ? `${userProfileData.first_name} ${userProfileData.last_name}`.trim()
                    : userProfileData?.first_name || userProfileData?.user_name || user?.user_metadata?.user_name || user?.user_metadata?.first_name || 'User'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    @{userProfileData?.user_name || user?.user_metadata?.user_name || (user?.email?.split('@')[0]) || 'user'}
                  </span>
                  {userBadges.some((b: any) => b.slug === 'insider') && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                      Insider
                    </span>
                  )}
                  {isOwnProfile && (
                    <button
                      className="flex items-center gap-0.5 transition-all hover:opacity-80"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onClick={() => {
                        setEditUsername(userProfileData?.user_name || '');
                        setEditFirstName(userProfileData?.first_name || '');
                        setEditLastName(userProfileData?.last_name || '');
                        setIsEditProfileOpen(true);
                      }}
                      data-testid="button-edit-profile"
                    >
                      <Settings size={9} />
                      <span className="text-[9px]">Edit profile</span>
                    </button>
                  )}
                </div>
                </div>
              </div>
              {!isOwnProfile && user && (
                <button
                  type="button"
                  onClick={() => setIsProfileOptionsOpen(true)}
                  className={proposed ? "ml-auto mr-1 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60" : "ml-auto mr-3 mt-1 shrink-0 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"}
                  aria-label="Profile options"
                  data-testid="button-profile-options"
                >
                  <MoreHorizontal size={18} />
                </button>
              )}
              <button
                onClick={() => setProfileShareMenuOpen(true)}
                className="text-white/50 hover:text-white/90 transition-colors flex-shrink-0 mt-1"
                data-testid="button-share-profile-inline"
              >
                <CornerUpRight size={16} />
              </button>
            </div>

 </div></div></div>
 <div className="px-6 pt-6 text-[13px] leading-relaxed text-[#817686]">
 <p className="font-semibold text-[#51445d]">{proposed ? "Tap the dots beside their name." : "This is the existing full-profile header."}</p>
 <p className="mt-2">{proposed ? "Proposed: keep Report and Block in this menu, not as standalone friend-list buttons. Choosing Block opens a separate confirmation." : "Full profiles already have a small options button here. The proposed version keeps this placement with a larger invisible tap area."}</p>
 <p className="mt-4 text-[11px]">Header excerpt only. The rest of the profile is unchanged.</p>
 {notice&&<p role="status" className="mt-4 text-[12px] text-violet-700">{notice}</p>}
 </div>
 <Sheet open={isProfileOptionsOpen} onOpenChange={setIsProfileOptionsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe bg-white text-gray-900">
          <SheetTitle className="text-base font-semibold text-gray-900 mb-4">
            {userProfileData?.display_name || userProfileData?.user_name ? `@${userProfileData?.user_name}` : 'User options'}
          </SheetTitle>
          <SheetDescription className="sr-only">Report or block this person.</SheetDescription><div className="flex flex-col gap-1">
            <button
              onClick={() => { setIsProfileOptionsOpen(false); setTimeout(() => setIsReportUserOpen(true), 150); }}
              className="flex items-center gap-3 w-full px-3 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <Flag size={18} className="text-gray-500" />
              <span className="text-sm font-medium">Report this user</span>
            </button>
            <button
              onClick={() => { setIsProfileOptionsOpen(false); setTimeout(() => setIsBlockConfirmOpen(true), 150); }}
              className="flex items-center gap-3 w-full px-3 py-3 text-left text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Ban size={18} className="text-red-500" />
              <span className="text-sm font-medium">Block this user</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
 <Sheet open={isBlockConfirmOpen} onOpenChange={setIsBlockConfirmOpen}><SheetContent side="bottom" className="rounded-t-2xl bg-white pb-6 text-gray-900"><SheetTitle className="mb-2 text-base font-semibold text-gray-900">Block @jordanreads?</SheetTitle><SheetDescription className="mb-6 text-sm text-gray-500">They won't be able to see your profile and you won't see their content, friend requests, or matches.</SheetDescription><div className="flex flex-col gap-3"><button className="min-h-11 rounded-full bg-red-600 px-4 py-3 font-semibold text-white" onClick={()=>{setIsBlockConfirmOpen(false);setNotice("Preview only—no account was blocked.");}}>Block user</button><button className="min-h-11 rounded-full border border-gray-200 px-4 py-3 font-semibold text-gray-700" onClick={()=>setIsBlockConfirmOpen(false)}>Cancel</button></div></SheetContent></Sheet>
 <Sheet open={isReportUserOpen} onOpenChange={setIsReportUserOpen}><SheetContent side="bottom" className="rounded-t-2xl bg-white text-gray-900"><SheetTitle>Report @jordanreads</SheetTitle><SheetDescription className="mt-3">This demonstrates placement only. The existing reporting flow is unchanged and no report will be sent.</SheetDescription></SheetContent></Sheet>
 </main>;
}
