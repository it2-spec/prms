import { SignJWT } from 'jose';
async function main(){ const secret = new TextEncoder().encode(process.env.AUTH_SECRET); const token = await new SignJWT({ id: 'cmsdzmf8r000macekuetbvrbx', username: 'purchasing', name: 'Admin', role: 'PURCHASING', supplierId: null, warehouseId: null }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(secret); console.log(token); }
main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
