// Candidate subscription sales belonged to the prototype. Employer purchases use /api/employer/checkout.
export async function POST(_request:Request){return Response.json({code:'candidate_billing_retired',error:'Job search and applications are free.'},{status:410});}
