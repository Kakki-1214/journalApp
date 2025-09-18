// Minimal hand-crafted OpenAPI spec (incremental)
export const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'Journal Backend API', version: '0.1.0' },
  paths: {
    '/healthz': { get: { summary: 'Extended health', responses: { '200': { description: 'OK' } } } },
    '/auth/email/register': { post: { summary: 'Register via email', requestBody: { required: true }, responses: { '200': { description: 'Registered' } } } },
    '/auth/email/login': { post: { summary: 'Login via email', requestBody: { required: true }, responses: { '200': { description: 'Token' } } } },
    '/auth/refresh': { post: { summary: 'Rotate refresh token', responses: { '200': { description: 'New access/refresh token' } } } },
    '/auth/logout': { post: { summary: 'Logout (revoke refresh)', responses: { '200': { description: 'Logged out' } } } },
    '/iap/verify': { post: { summary: 'Verify purchase / subscription', responses: { '200': { description: 'Verification result' } } } },
    '/iap/status': { get: { summary: 'Current subscription status', responses: { '200': { description: 'Status object' } } } },
    '/journal': { get: { summary: 'List journal entries', responses: { '200': { description: 'List' } } }, post: { summary: 'Create journal entry', responses: { '200': { description: 'Created' } } } },
    '/journal/{id}': { delete: { summary: 'Delete journal entry', parameters: [{ name:'id', in:'path', required:true, schema:{ type:'string' } }], responses: { '200': { description: 'Deleted' } } } },
    '/entitlements': { get: { summary: 'Capability flags', responses: { '200': { description: 'Entitlements' } } } }
  }
};