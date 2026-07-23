import 'dotenv/config';
import { prisma } from './lib/prisma.js';

const PLANS = [
  {
    plan_name: 'free',
    features: {
      photo_capture: false,
      voice_command: false,
      file_upload: false,
      ai_consulting: false,
      advanced_reports: false,
      bills_management: true,
      goals_tracking: true,
      unlimited_transactions: false,
    },
    pricing: { monthly_price: 0, yearly_price: 0 },
    transaction_limit: 10,
    active: true,
  },
  {
    plan_name: 'premium',
    features: {
      photo_capture: true,
      voice_command: true,
      file_upload: true,
      ai_consulting: true,
      advanced_reports: true,
      bills_management: true,
      goals_tracking: true,
      unlimited_transactions: true,
    },
    pricing: { monthly_price: 29.9, yearly_price: 299 },
    transaction_limit: -1,
    active: true,
  },
];

async function main() {
  for (const plan of PLANS) {
    const exists = await prisma.subscriptionPlan.findUnique({ where: { plan_name: plan.plan_name } });
    if (exists) continue;
    await prisma.subscriptionPlan.create({
      data: {
        plan_name: plan.plan_name,
        features: JSON.stringify(plan.features),
        pricing: JSON.stringify(plan.pricing),
        transaction_limit: plan.transaction_limit,
        active: plan.active,
        created_by: 'system',
      },
    });
    console.log(`Seeded subscription plan: ${plan.plan_name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
