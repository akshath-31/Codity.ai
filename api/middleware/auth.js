const { supabase } = require('../config/supabase');

/**
 * Authentication Middleware
 * Validates the Supabase JWT and attaches the user profile (including organization_id) to the request.
 * 
 * TRADE-OFF EXPLANATION:
 * Since this API uses the Supabase Service Role key (which completely bypasses Row Level Security),
 * we cannot rely on Postgres to filter data automatically. Therefore, every single route handler MUST
 * explicitly append `.eq('organization_id', req.user.organization_id)` (or traverse relationships
 * to verify organization ownership) to prevent cross-tenant data leakage.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the JWT using Supabase's native auth (safest, checks expiry and revocation)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }

    // Lookup the user's organization profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'User profile or organization not found' } });
    }

    req.user = {
      id: profile.id,
      organization_id: profile.organization_id,
      role: profile.role
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
