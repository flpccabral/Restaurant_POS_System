const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const Subscription = require("../models/subscriptionModel");
const Plan = require("../models/planModel");
const Store = require("../models/storeModel");
const SessionLog = require("../models/sessionLogModel");

/**
 * Listar planos disponíveis
 */
const getPlans = async (req, res, next) => {
    try {
        const { billingCycle } = req.query;

        const filter = { isActive: true };

        if (billingCycle && ['monthly', 'quarterly', 'yearly'].includes(billingCycle)) {
            filter.billingCycle = billingCycle;
        }

        const plans = await Plan.find(filter).sort({ price: 1 });

        res.status(200).json({
            success: true,
            count: plans.length,
            data: plans.map(plan => ({
                ...plan.toObject(),
                formattedPrice: plan.formattedPrice,
                discountedPrice: plan.discountedPrice,
                isPopular: plan.isPopular
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter plano por ID
 */
const getPlanById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const plan = await Plan.findById(id);

        if (!plan) {
            const error = createHttpError(404, "Plan not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: plan
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter assinatura atual da loja
 */
const getCurrentSubscription = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.getActiveSubscription(storeRef);

        if (!subscription) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No active subscription found"
            });
        }

        // Atualizar usage
        await subscription.updateUsage();

        // Verificar limites
        const limitsCheck = await subscription.checkLimits();

        // Verificar trial
        const trialInfo = subscription.checkTrial();

        res.status(200).json({
            success: true,
            data: {
                ...subscription.toObject(),
                isTrial: trialInfo.isTrial,
                daysRemaining: trialInfo.daysRemaining,
                limitsCheck,
                isActive: subscription.isActive
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar nova assinatura (com trial)
 */
const createSubscription = async (req, res, next) => {
    try {
        const { planId, paymentMethod } = req.body;

        if (!planId) {
            const error = createHttpError(400, "Plan ID is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar se já existe assinatura ativa
        const existing = await Subscription.findOne({
            store: storeRef,
            status: { $in: ['active', 'trialing'] }
        });

        if (existing) {
            const error = createHttpError(400, "Store already has an active subscription!");
            return next(error);
        }

        // Verificar plano
        const plan = await Plan.findById(planId);

        if (!plan) {
            const error = createHttpError(404, "Plan not found!");
            return next(error);
        }

        if (!plan.isActive) {
            const error = createHttpError(400, "Plan is not active!");
            return next(error);
        }

        // Criar assinatura com trial
        const trialDays = plan.trialDays || 7;
        const subscription = await Subscription.createWithTrial(storeRef, planId, trialDays);

        // Atualizar usage inicial
        await subscription.updateUsage();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'subscription_created',
            metadata: {
                subscriptionId: subscription.subscriptionId,
                planId: plan.planId,
                planName: plan.name,
                trialDays
            }
        });

        res.status(201).json({
            success: true,
            message: `Subscription created with ${trialDays} days trial!`,
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar plano (upgrade/downgrade)
 */
const updateSubscription = async (req, res, next) => {
    try {
        const { planId } = req.body;

        if (!planId) {
            const error = createHttpError(400, "Plan ID is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            const error = createHttpError(404, "Subscription not found!");
            return next(error);
        }

        // Verificar novo plano
        const newPlan = await Plan.findById(planId);

        if (!newPlan) {
            const error = createHttpError(404, "Plan not found!");
            return next(error);
        }

        // Determinar tipo de mudança
        const isUpgrade = newPlan.price > subscription.price;
        const isDowngrade = newPlan.price < subscription.price;

        // Atualizar assinatura
        subscription.plan = planId;
        subscription.price = newPlan.price;
        subscription.discountPercent = newPlan.discountPercent;

        if (isUpgrade) {
            // Upgrade imediato
            subscription.status = 'active';
            subscription.trialEnd = null;
        } else if (isDowngrade) {
            // Downgrade no próximo ciclo
            // Manter status atual, aplicar no próximo billing
        }

        await subscription.save();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'subscription_updated',
            metadata: {
                subscriptionId: subscription.subscriptionId,
                newPlanId: newPlan.planId,
                newPlanName: newPlan.name,
                isUpgrade,
                isDowngrade
            }
        });

        res.status(200).json({
            success: true,
            message: `Subscription ${isUpgrade ? 'upgraded' : isDowngrade ? 'downgraded' : 'updated'} successfully!`,
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancelar assinatura
 */
const cancelSubscription = async (req, res, next) => {
    try {
        const { reason, feedback } = req.body;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            const error = createHttpError(404, "Subscription not found!");
            return next(error);
        }

        if (subscription.status === 'canceled' || subscription.status === 'expired') {
            const error = createHttpError(400, "Subscription is already canceled!");
            return next(error);
        }

        await subscription.cancel(reason, feedback);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'subscription_canceled',
            metadata: {
                subscriptionId: subscription.subscriptionId,
                reason
            }
        });

        res.status(200).json({
            success: true,
            message: "Subscription canceled successfully!",
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reativar assinatura cancelada
 */
const reactivateSubscription = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            const error = createHttpError(404, "Subscription not found!");
            return next(error);
        }

        if (subscription.status !== 'canceled' && subscription.status !== 'expired') {
            const error = createHttpError(400, `Cannot reactivate subscription with status: ${subscription.status}`);
            return next(error);
        }

        await subscription.reactivate();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'subscription_reactivated',
            metadata: {
                subscriptionId: subscription.subscriptionId
            }
        });

        res.status(200).json({
            success: true,
            message: "Subscription reactivated successfully!",
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar limites de uso
 */
const checkUsageLimits = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            const error = createHttpError(404, "Subscription not found!");
            return next(error);
        }

        // Atualizar usage
        await subscription.updateUsage();

        // Verificar limites
        const limitsCheck = await subscription.checkLimits();

        res.status(200).json({
            success: true,
            data: {
                usage: subscription.usage,
                limitsCheck,
                isActive: subscription.isActive
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter histórico de faturas
 */
const getInvoices = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({
            store: storeRef
        }).sort({ createdAt: -1 });

        if (!subscription) {
            const error = createHttpError(404, "Subscription not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            count: subscription.invoices?.length || 0,
            data: subscription.invoices || []
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Estatísticas de assinaturas (Admin)
 */
const getSubscriptionStats = async (req, res, next) => {
    try {
        // Apenas master admin
        if (!req.user.isMasterAdmin) {
            const error = createHttpError(403, "Only master admin can access subscription stats!");
            return next(error);
        }

        // Total por status
        const statusCount = await Subscription.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Total por plano
        const planCount = await Subscription.aggregate([
            {
                $match: { status: { $in: ['active', 'trialing'] } }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'plan',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            { $unwind: '$planInfo' },
            {
                $group: {
                    _id: '$planInfo.name',
                    count: { $sum: 1 },
                    revenue: { $sum: '$price' }
                }
            }
        ]);

        // Receita mensal recorrente (MRR)
        const mrrResult = await Subscription.aggregate([
            {
                $match: { status: { $in: ['active', 'trialing'] } }
            },
            {
                $group: {
                    _id: null,
                    mrr: { $sum: '$price' }
                }
            }
        ]);

        // Trials ativos
        const activeTrials = await Subscription.countDocuments({
            status: 'trialing',
            trialEnd: { $gt: new Date() }
        });

        // Trials vencendo em 3 dias
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const trialsExpiring = await Subscription.countDocuments({
            status: 'trialing',
            trialEnd: { $lte: threeDaysFromNow, $gt: new Date() }
        });

        const statusMap = {};
        statusCount.forEach(s => {
            statusMap[s._id] = s.count;
        });

        const mrr = mrrResult[0]?.mrr || 0;

        res.status(200).json({
            success: true,
            data: {
                subscriptions: {
                    total: Object.values(statusMap).reduce((a, b) => a + b, 0),
                    byStatus: statusMap
                },
                plans: planCount.map(p => ({
                    name: p._id,
                    count: p.count,
                    revenue: p.revenue
                })),
                revenue: {
                    mrr,
                    mrrFormatted: (mrr / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    })
                },
                trials: {
                    active: activeTrials,
                    expiringSoon: trialsExpiring
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar planos iniciais (Seed)
 */
const seedPlans = async (req, res, next) => {
    try {
        // Apenas master admin
        if (!req.user.isMasterAdmin) {
            const error = createHttpError(403, "Only master admin can seed plans!");
            return next(error);
        }

        const plans = [
            {
                planId: 'basic',
                name: 'Basic',
                slug: 'basic',
                description: 'Para pequenos negócios',
                price: 9900, // R$ 99,00
                billingCycle: 'monthly',
                discountPercent: 10,
                limits: {
                    stores: 1,
                    users: 5,
                    devices: 3,
                    orders: 500,
                    products: 100
                },
                features: [
                    { name: 'multi_tenancy', description: 'Multi-tenancy', included: true },
                    { name: 'inventory', description: 'Gestão de estoque', included: true },
                    { name: 'recipes', description: 'Fichas técnicas', included: true },
                    { name: 'reports', description: 'Relatórios básicos', included: true },
                    { name: 'websockets', description: 'Tempo real', included: false },
                    { name: 'api_access', description: 'API completa', included: false }
                ],
                trialDays: 7,
                isPopular: false,
                isActive: true
            },
            {
                planId: 'pro',
                name: 'Pro',
                slug: 'pro',
                description: 'Para negócios em crescimento',
                price: 19900, // R$ 199,00
                billingCycle: 'monthly',
                discountPercent: 15,
                limits: {
                    stores: 3,
                    users: 15,
                    devices: 10,
                    orders: 0, // ilimitado
                    products: 0 // ilimitado
                },
                features: [
                    { name: 'multi_tenancy', description: 'Multi-tenancy', included: true },
                    { name: 'inventory', description: 'Gestão de estoque', included: true },
                    { name: 'recipes', description: 'Fichas técnicas', included: true },
                    { name: 'reports', description: 'Relatórios completos', included: true },
                    { name: 'websockets', description: 'Tempo real', included: true },
                    { name: 'api_access', description: 'API completa', included: true },
                    { name: 'priority_support', description: 'Suporte prioritário', included: true }
                ],
                trialDays: 14,
                isPopular: true,
                isActive: true
            },
            {
                planId: 'enterprise',
                name: 'Enterprise',
                slug: 'enterprise',
                description: 'Para redes e franquias',
                price: 39900, // R$ 399,00
                billingCycle: 'monthly',
                discountPercent: 20,
                limits: {
                    stores: 0, // ilimitado
                    users: 0, // ilimitado
                    devices: 0, // ilimitado
                    orders: 0, // ilimitado
                    products: 0 // ilimitado
                },
                features: [
                    { name: 'multi_tenancy', description: 'Multi-tenancy', included: true },
                    { name: 'inventory', description: 'Gestão de estoque', included: true },
                    { name: 'recipes', description: 'Fichas técnicas', included: true },
                    { name: 'reports', description: 'Relatórios avançados', included: true },
                    { name: 'websockets', description: 'Tempo real', included: true },
                    { name: 'api_access', description: 'API completa', included: true },
                    { name: 'priority_support', description: 'Suporte prioritário', included: true },
                    { name: 'custom_integration', description: 'Integrações customizadas', included: true },
                    { name: 'dedicated_support', description: 'Suporte dedicado', included: true }
                ],
                trialDays: 30,
                isPopular: false,
                isActive: true
            }
        ];

        const created = [];
        for (const planData of plans) {
            const plan = await Plan.findOneAndUpdate(
                { slug: planData.slug },
                planData,
                { upsert: true, new: true }
            );
            created.push(plan);
        }

        res.status(200).json({
            success: true,
            message: `${created.length} plans seeded successfully!`,
            data: created
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPlans,
    getPlanById,
    getCurrentSubscription,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    checkUsageLimits,
    getInvoices,
    getSubscriptionStats,
    seedPlans
};
