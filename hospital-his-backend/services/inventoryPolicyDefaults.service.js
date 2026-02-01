/**
 * Inventory Policy Defaults Service
 * Ensures default policy values are applied to inventory items on server startup.
 * This is idempotent - it only sets policy values if they're not already set.
 *
 * Run automatically on server startup (no manual command needed)
 */

const InventoryItem = require('../models/InventoryItem');
const InventoryCategory = require('../models/InventoryCategory');
const User = require('../models/User');
const logger = require('../utils/logger');

// Hardcoded policy defaults for the 11 items
const INVENTORY_POLICY_DEFAULTS = [
    {
        itemName: 'Disposable Syringe 5ml',
        itemCode: 'NM-002',
        policy: {
            minLevel: 100,
            targetLevel: 300,
            priority: 5,
            leadTimeDays: 5,
            unitCost: 8,
            maxOrderQty: 500,
        },
        policyCategory: 'general_stores',
        uom: 'BOX',
        categoryCode: 'CONS',
    },
    {
        itemName: 'Surgical Gloves (Latex) - Medium',
        itemCode: 'NM-001',
        policy: {
            minLevel: 200,
            targetLevel: 600,
            priority: 5,
            leadTimeDays: 4,
            unitCost: 15,
            maxOrderQty: 1000,
        },
        policyCategory: 'general_stores',
        uom: 'BOX',
        categoryCode: 'CONS',
    },
    {
        itemName: 'N95 Face Mask',
        itemCode: 'NM-011',
        policy: {
            minLevel: 30,
            targetLevel: 120,
            priority: 5,
            leadTimeDays: 7,
            unitCost: 60,
            maxOrderQty: 300,
        },
        policyCategory: 'general_stores',
        uom: 'BOX',
        categoryCode: 'CONS',
    },
    {
        itemName: 'IV Cannula',
        itemCode: 'NM-012',
        policy: {
            minLevel: 80,
            targetLevel: 250,
            priority: 5,
            leadTimeDays: 6,
            unitCost: 25,
            maxOrderQty: 500,
        },
        policyCategory: 'general_stores',
        uom: 'BOX',
        categoryCode: 'CONS',
    },
    {
        itemName: 'Cotton Roll',
        itemCode: 'NM-013',
        policy: {
            minLevel: 50,
            targetLevel: 150,
            priority: 3,
            leadTimeDays: 3,
            unitCost: 20,
            maxOrderQty: 300,
        },
        policyCategory: 'general_stores',
        uom: 'PCS',
        categoryCode: 'CARE',
    },
    {
        itemName: 'Gauze Pads',
        itemCode: 'NM-014',
        policy: {
            minLevel: 150,
            targetLevel: 400,
            priority: 4,
            leadTimeDays: 5,
            unitCost: 5,
            maxOrderQty: 1000,
        },
        policyCategory: 'general_stores',
        uom: 'BOX',
        categoryCode: 'CONS',
    },
    {
        itemName: 'Bandage Roll',
        itemCode: 'NM-015',
        policy: {
            minLevel: 60,
            targetLevel: 200,
            priority: 4,
            leadTimeDays: 5,
            unitCost: 30,
            maxOrderQty: 400,
        },
        policyCategory: 'general_stores',
        uom: 'PCS',
        categoryCode: 'CARE',
    },
    {
        itemName: 'Bedsheet (Hospital Linen)',
        itemCode: 'NM-006',
        policy: {
            minLevel: 40,
            targetLevel: 100,
            priority: 2,
            leadTimeDays: 10,
            unitCost: 350,
            maxOrderQty: 80,
        },
        policyCategory: 'general_stores',
        uom: 'PCS',
        categoryCode: 'CARE',
    },
    {
        itemName: 'Wheelchair (Standard)',
        itemCode: 'NM-004',
        policy: {
            minLevel: 2,
            targetLevel: 5,
            priority: 3,
            leadTimeDays: 14,
            unitCost: 6000,
            maxOrderQty: 5,
        },
        policyCategory: 'equipment',
        uom: 'PCS',
        categoryCode: 'EQUIP',
    },
    {
        itemName: 'Stethoscope',
        itemCode: 'NM-016',
        policy: {
            minLevel: 3,
            targetLevel: 8,
            priority: 2,
            leadTimeDays: 5,
            unitCost: 1200,
            maxOrderQty: 10,
        },
        policyCategory: 'equipment',
        uom: 'PCS',
        categoryCode: 'EQUIP',
    },
    {
        itemName: 'Thermometer (Digital)',
        itemCode: 'NM-017',
        policy: {
            minLevel: 5,
            targetLevel: 15,
            priority: 3,
            leadTimeDays: 5,
            unitCost: 250,
            maxOrderQty: 30,
        },
        policyCategory: 'equipment',
        uom: 'PCS',
        categoryCode: 'EQUIP',
    },
];

/**
 * Ensures all inventory items have their policy defaults set.
 * Creates items if they don't exist, updates policy if not already set.
 */
const ensureInventoryPolicyDefaults = async () => {
    try {
        logger.info('🔧 Checking inventory policy defaults...');

        // Get admin user for createdBy field
        let createdByUser = await User.findOne({ role: 'inventory_manager' });
        if (!createdByUser) {
            createdByUser = await User.findOne({ role: 'admin' });
        }
        if (!createdByUser) {
            logger.warn('⚠️ No admin/inventory_manager user found. Skipping inventory policy seeding.');
            return;
        }

        // Get category map
        const categories = await InventoryCategory.find({});
        const categoryMap = {};
        categories.forEach((cat) => {
            categoryMap[cat.categoryCode] = cat._id;
        });

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const itemDef of INVENTORY_POLICY_DEFAULTS) {
            let item = await InventoryItem.findOne({ itemCode: itemDef.itemCode });

            if (!item) {
                // Create new item with policy
                const categoryId = categoryMap[itemDef.categoryCode];
                if (!categoryId) {
                    logger.warn(`⚠️ Category ${itemDef.categoryCode} not found. Skipping ${itemDef.itemName}.`);
                    continue;
                }

                item = await InventoryItem.create({
                    itemCode: itemDef.itemCode,
                    itemName: itemDef.itemName,
                    category: categoryId,
                    uom: itemDef.uom,
                    reorderLevel: itemDef.policy.minLevel,
                    maxStockLevel: itemDef.policy.targetLevel,
                    policy: itemDef.policy,
                    policyCategory: itemDef.policyCategory,
                    createdBy: createdByUser._id,
                });
                logger.info(`   ✅ Created: ${itemDef.itemName}`);
                created++;
            } else if (!item.policy || item.policy.minLevel === 0) {
                // Update existing item with policy (only if not already set)
                item.policy = itemDef.policy;
                item.policyCategory = itemDef.policyCategory;
                item.reorderLevel = itemDef.policy.minLevel;
                item.maxStockLevel = itemDef.policy.targetLevel;
                await item.save();
                logger.info(`   🔄 Updated: ${itemDef.itemName}`);
                updated++;
            } else {
                // Already has policy, skip
                skipped++;
            }
        }

        logger.info(`🔧 Inventory policy defaults complete: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (error) {
        logger.error(`❌ Error ensuring inventory policy defaults: ${error.message}`);
        // Don't throw - this shouldn't prevent server startup
    }
};

module.exports = {
    ensureInventoryPolicyDefaults,
    INVENTORY_POLICY_DEFAULTS,
};
