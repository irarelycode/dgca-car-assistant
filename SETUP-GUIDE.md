# Fix the secret - 5 minute setup

1. REVOKE OLD KEY
   - console.groq.com > API Keys > delete gsk_YO3q...

2. CREATE NEW KEY
   - Create new key, copy it

3. CLOUDFLARE WORKER
   - dash.cloudflare.com > sign up free
   - Workers & Pages > Create Worker > name: dgca-groq-proxy
   - Replace code with worker.js from this zip
   - Deploy
   - Settings > Variables > Add variable > type Secret > name: GROQ_API_KEY > paste new key > Save

4. COPY WORKER URL
   - It looks like https://dgca-groq-proxy.yourname.workers.dev

5. UPDATE YOUR SITE
   - In GitHub, edit config.js
   - Replace WORKER_URL with your worker URL
   - Commit

Done - key is now secret, GitHub happy.
