import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  // 🔥 এই output লাইনটা রিমুভ করুন অথবা কমেন্ট করুন
  // output: './prisma/generated/prisma',  // ❌ এই লাইনটা মুছে দিন

  // অথবা ডিফল্ট @prisma/client এ সেট করুন:
  // output: '@prisma/client',  // ✅ এটা দিন
});