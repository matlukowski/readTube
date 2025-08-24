# Clerk + Google OAuth2 + YouTube API Integration Research

## 🔍 Current Clerk Setup Analysis

### **Discovered Architecture:**

1. **Basic Clerk Integration:**
   ```typescript
   // src/components/providers/ThemeProvider.tsx
   <ClerkProvider
     appearance={getClerkAppearance(theme)}
     localization={polishLocalization}
   >
   ```

2. **Standard Auth Middleware:**
   ```typescript
   // src/middleware.ts
   clerkMiddleware(async (auth, req) => {
     if (isProtectedRoute(req)) {
       await auth.protect()
     }
   })
   ```

3. **User Management:**
   - Webhook-based user sync (`src/app/api/webhooks/clerk/route.ts`)
   - Basic user CRUD operations (`src/lib/user.ts`)

## 🧪 Research Questions to Answer

### **Phase 1: Token Access Investigation**

1. **Can we access raw Google OAuth tokens from Clerk session?**
   - Test endpoint: `/api/debug/clerk-session`
   - Check `auth().getToken()` with various templates
   - Examine `user.externalAccounts` structure

2. **What OAuth scopes does current Google integration have?**
   - Default Google provider scopes (likely just profile + email)
   - Can we see current scopes in session data?

3. **How does token refresh work in Clerk?**
   - Automatic vs manual refresh
   - Token expiration handling
   - Long-term token storage

### **Phase 2: Scope Expansion Research**

1. **Can we add YouTube scope to existing Google provider?**
   - Clerk Dashboard configuration options
   - Impact on existing users (re-consent required?)
   - Incremental authorization support

2. **Alternative integration patterns:**
   - Custom OAuth provider with YouTube scopes
   - Hybrid approach: Clerk auth + separate YouTube OAuth
   - Server-side token proxy patterns

## 🎯 Potential Integration Paths

### **Path A: Extend Clerk Google Provider (IDEAL)**
```typescript
// Hypothetical: if Clerk allows custom scopes
<ClerkProvider
  googleOAuthScopes={[
    'openid',
    'email', 
    'profile',
    'https://www.googleapis.com/auth/youtube.readonly' // ADD THIS
  ]}
>
```

**Pros:** Single OAuth flow, seamless UX
**Cons:** May require user re-consent, Clerk may not support custom scopes

### **Path B: Clerk Session + YouTube Token Mapping**
```typescript
// Use Clerk user ID to link separate YouTube OAuth
const { userId } = await auth();
const youtubeToken = await getYouTubeTokenForUser(userId);
// Custom token management system
```

**Pros:** Full control over YouTube integration
**Cons:** Separate OAuth flow, more complex UX

### **Path C: Server-Side Token Proxy**
```typescript
// Server handles all OAuth complexity
const { userId } = await auth();
const youtubeData = await serverSideYouTubeCall(userId, videoId);
// Hide token complexity from client
```

**Pros:** Simplified client, centralized token management
**Cons:** More server complexity, potential latency

## 📋 Investigation Checklist

### **Immediate Tests (Phase 1):**
- [ ] Deploy debug endpoint and test with authenticated user
- [ ] Check if `user.externalAccounts` contains Google OAuth data
- [ ] Test `getToken()` with different template names
- [ ] Analyze session structure for hidden OAuth fields

### **Clerk Configuration Research (Phase 2):**
- [ ] Check Clerk Dashboard for Google provider scope options
- [ ] Research Clerk documentation for custom OAuth scopes
- [ ] Test incremental authorization patterns with Google
- [ ] Investigate Clerk custom claims and metadata storage

### **Integration Planning (Phase 3):**
- [ ] Design chosen architecture based on findings
- [ ] Plan migration strategy for existing users
- [ ] Create implementation timeline
- [ ] Update existing YouTube API clients

## 🔧 Debug Tools Created

1. **`/api/debug/clerk-session`** - Comprehensive Clerk session analysis
2. **`/api/debug/transcription`** - Current system health check
3. **`/api/youtube-auth/debug`** - OAuth2 configuration validation

## 📊 Expected Outcomes

### **Best Case Scenario:**
- Clerk provides raw Google OAuth tokens with YouTube scope capability
- Single OAuth flow eliminates redirect_uri_mismatch issues
- Seamless user experience with automatic YouTube access

### **Realistic Scenario:**
- Hybrid approach needed: Clerk auth + separate YouTube OAuth
- Improved UX over current implementation (no Google Cloud Console config issues)
- Server-side token management with Clerk user ID linkage

### **Fallback Scenario:**
- Current separate OAuth2 system with enhanced error handling
- Better troubleshooting and user guidance
- Focus on fixing redirect_uri_mismatch and configuration issues

---

**Next Step:** Test debug endpoint to understand what OAuth data Clerk actually provides.