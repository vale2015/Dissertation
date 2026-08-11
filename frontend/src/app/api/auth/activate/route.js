import{forwardPublicAccountRequest}from"@/lib/public-auth-proxy";export async function POST(request){return forwardPublicAccountRequest(request,"auth/activate")}
