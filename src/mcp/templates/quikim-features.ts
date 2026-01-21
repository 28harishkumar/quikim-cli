/**
 * Quikim Features Templates
 * Pre-built feature templates for Quikim Dashboard features
 */

export interface QuikimFeature {
  id: string;
  name: string;
  category: 'auth' | 'payment' | 'crm' | 'analytics' | 'storage' | 'communication';
  description: string;
  codeTemplate: (config: FeatureConfig) => string;
  dependencies: string[];
  prismaModels?: string[];
}

export interface FeatureConfig {
  projectName: string;
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    mobile?: string[];
  };
  theme?: any;
  customConfig?: Record<string, any>;
}

/**
 * Authentication Feature Template
 */
export const authFeature: QuikimFeature = {
  id: 'quikim-auth',
  name: 'Authentication',
  category: 'auth',
  description: 'Complete authentication system with JWT, OAuth, and session management',
  dependencies: ['jsonwebtoken', 'bcrypt', 'passport'],
  prismaModels: ['User', 'Session', 'RefreshToken'],
  codeTemplate: (config: FeatureConfig) => {
    const isTypeScript = config.techStack.backend?.includes('TypeScript');
    
    return `
// Authentication Service
${isTypeScript ? 'import { User } from \'@prisma/client\';' : ''}
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  async register(email${isTypeScript ? ': string' : ''}, password${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<User>' : ''} {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Implementation here
  }

  async login(email${isTypeScript ? ': string' : ''}, password${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<{ token: string; user: User }>' : ''} {
    // Implementation here
  }

  async verifyToken(token${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<User | null>' : ''} {
    // Implementation here
  }
}
`;
  }
};

/**
 * Payment Feature Template
 */
export const paymentFeature: QuikimFeature = {
  id: 'quikim-payment',
  name: 'Payment Processing',
  category: 'payment',
  description: 'Payment gateway integration with Stripe, PayPal, and Razorpay',
  dependencies: ['stripe', '@paypal/checkout-server-sdk', 'razorpay'],
  prismaModels: ['Payment', 'Transaction', 'Invoice'],
  codeTemplate: (config: FeatureConfig) => {
    const isTypeScript = config.techStack.backend?.includes('TypeScript');
    
    return `
// Payment Service
${isTypeScript ? 'import Stripe from \'stripe\';' : 'const Stripe = require(\'stripe\');'}

export class PaymentService {
  private stripe${isTypeScript ? ': Stripe' : ''};

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY${isTypeScript ? '!' : ''});
  }

  async createPaymentIntent(amount${isTypeScript ? ': number' : ''}, currency${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<Stripe.PaymentIntent>' : ''} {
    return await this.stripe.paymentIntents.create({
      amount,
      currency,
    });
  }

  async processPayment(paymentIntentId${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<void>' : ''} {
    // Implementation here
  }
}
`;
  }
};

/**
 * CRM Feature Template
 */
export const crmFeature: QuikimFeature = {
  id: 'quikim-crm',
  name: 'Customer Relationship Management',
  category: 'crm',
  description: 'Complete CRM system with contacts, deals, and pipeline management',
  dependencies: [],
  prismaModels: ['Contact', 'Deal', 'Pipeline', 'Activity'],
  codeTemplate: (config: FeatureConfig) => {
    const isTypeScript = config.techStack.backend?.includes('TypeScript');
    
    return `
// CRM Service
export class CRMService {
  async createContact(data${isTypeScript ? ': any' : ''})${isTypeScript ? ': Promise<any>' : ''} {
    // Implementation here
  }

  async createDeal(data${isTypeScript ? ': any' : ''})${isTypeScript ? ': Promise<any>' : ''} {
    // Implementation here
  }

  async updatePipeline(dealId${isTypeScript ? ': string' : ''}, stage${isTypeScript ? ': string' : ''})${isTypeScript ? ': Promise<void>' : ''} {
    // Implementation here
  }
}
`;
  }
};

/**
 * All Quikim Features Registry
 */
export const quikimFeatures: Record<string, QuikimFeature> = {
  'quikim-auth': authFeature,
  'quikim-payment': paymentFeature,
  'quikim-crm': crmFeature,
};

/**
 * Check if a feature is a Quikim feature
 */
export function isQuikimFeature(featureName: string): boolean {
  return featureName.startsWith('quikim-') || Object.keys(quikimFeatures).includes(featureName);
}

/**
 * Get Quikim feature by ID
 */
export function getQuikimFeature(featureId: string): QuikimFeature | undefined {
  return quikimFeatures[featureId];
}

/**
 * Generate code for a Quikim feature
 */
export function generateQuikimFeatureCode(featureId: string, config: FeatureConfig): string | null {
  const feature = getQuikimFeature(featureId);
  if (!feature) {
    return null;
  }
  
  return feature.codeTemplate(config);
}

/**
 * Get all Quikim features from requirements
 */
export function extractQuikimFeatures(requirementsContent: string): string[] {
  const features: string[] = [];
  const lines = requirementsContent.toLowerCase().split('\n');
  
  for (const line of lines) {
    if (line.includes('authentication') || line.includes('auth')) {
      features.push('quikim-auth');
    }
    if (line.includes('payment') || line.includes('stripe') || line.includes('paypal')) {
      features.push('quikim-payment');
    }
    if (line.includes('crm') || line.includes('customer relationship')) {
      features.push('quikim-crm');
    }
  }
  
  return [...new Set(features)]; // Remove duplicates
}
