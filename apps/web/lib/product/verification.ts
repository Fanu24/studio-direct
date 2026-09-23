import type {PlatformEnv,Database} from '../platform';
export async function submitVerificationEvidence(env:Pick<PlatformEnv,'DB'|'FILES'>,userId:string,file:File){
 const row=await env.DB.prepare("SELECT id,evidence_key FROM candidate_verification_requests WHERE user_id=? AND status IN ('awaiting_evidence','rejected') ORDER BY created_at DESC LIMIT 1").bind(userId).first<{id:string;evidence_key:string|null}>();if(!row)throw Error('Purchase a verification review first.');
 const key=await putPrivateEvidence(env,'identity-evidence/'+userId+'/'+crypto.randomUUID(),file);
 try{const result=await env.DB.prepare("UPDATE candidate_verification_requests SET evidence_key=?,status='pending',submitted_at=?,reason=NULL WHERE id=? AND status IN ('awaiting_evidence','rejected')").bind(key,new Date().toISOString(),row.id).run();if(!result.meta?.changes)throw Error('Verification already submitted.');}catch(error){await env.FILES.delete?.(key);throw error;}
 if(row.evidence_key)await env.FILES.delete?.(row.evidence_key);
}
export async function putPrivateEvidence(env:Pick<PlatformEnv,'FILES'>,key:string,file:File){
 if(!file.size||file.size>5*1024*1024)throw Error('Upload a PDF, JPEG or PNG file up to 5 MB.');const bytes=new Uint8Array(await file.arrayBuffer());
 const ascii=new TextDecoder().decode(bytes.slice(0,8)),type=ascii.startsWith('%PDF-')?'application/pdf':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===137&&ascii.slice(1,4)==='PNG'?'image/png':null;
 if(!type)throw Error('Use a PDF, JPEG or PNG document.');await env.FILES.put(key,bytes.buffer as ArrayBuffer,{httpMetadata:{contentType:type}});return key;
}
export async function reviewCandidateVerification(db:Database,input:{id:string;adminId:string;tenantId:string;approve:boolean;reason:string},now=new Date()){
 if(input.reason.trim().length<10||input.reason.length>2000)throw Error('Record the reason for your decision.');const row=await db.prepare("SELECT v.user_id FROM candidate_verification_requests v JOIN product_orders o ON o.id=v.order_id WHERE v.id=? AND v.status='pending' AND v.evidence_key IS NOT NULL AND o.status='paid' AND o.tenant_id=?").bind(input.id,input.tenantId).first<{user_id:string}>();if(!row)throw Error('Paid verification evidence is not pending.');
 await db.batch([
 db.prepare("UPDATE candidate_verification_requests SET status=?,reviewed_by=?,reviewed_at=?,reason=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM product_orders o WHERE o.id=candidate_verification_requests.order_id AND o.status='paid')").bind(input.approve?'approved':'rejected',input.adminId,now.toISOString(),input.reason.trim(),input.id),
 db.prepare("UPDATE profiles SET verified_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM candidate_verification_requests WHERE id=? AND status='approved')").bind(now.toISOString(),row.user_id,input.id),
 db.prepare('INSERT INTO product_admin_audit VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.adminId,'candidate_verification',input.id,input.reason,now.toISOString()),
 db.prepare("INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) VALUES(?,?,'verification_result','Your verification review is complete',?,'/account/verification',?)").bind('verification:'+input.id+':'+now.toISOString(),row.user_id,input.approve?'Your identity verification was approved.':'Your verification needs more evidence. Review the decision in your account.',now.toISOString()),
 ]);
}
