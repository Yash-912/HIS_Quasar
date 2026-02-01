/**
 * ItemMaster Page
 * CRUD operations for inventory items
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Calendar, RefreshCcw, Bot, Loader2, CheckCircle, XCircle, Package } from 'lucide-react';
import inventoryManagerService from '../../services/inventoryManager.service';
import './ItemMaster.css';

const ItemMaster = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0
    });

    // Agent state
    const [agentRunning, setAgentRunning] = useState(false);
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [agentResult, setAgentResult] = useState(null);
    const [fulfilling, setFulfilling] = useState(false);

    useEffect(() => {
        fetchCategories();
        fetchItems();
    }, [pagination.page, selectedCategory, searchTerm]);

    const fetchCategories = async () => {
        try {
            const response = await inventoryManagerService.getCategories();
            setCategories(response?.data || response || []);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchItems = async () => {
        try {
            setLoading(true);
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                isActive: true
            };
            if (searchTerm) params.search = searchTerm;
            if (selectedCategory) params.category = selectedCategory;

            const response = await inventoryManagerService.getItems(params);
            setItems(response?.data || response || []);
            setPagination(prev => ({ ...prev, total: response?.pagination?.total || 0 }));
            setError(null);
        } catch (err) {
            setError('Failed to load items');
            console.error('Items error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleCategoryFilter = (e) => {
        setSelectedCategory(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDeactivate = async (id, itemName) => {
        if (!window.confirm(`Are you sure you want to deactivate "${itemName}"?`)) return;

        const reason = prompt('Please provide a reason for deactivation:');
        if (!reason) return;

        try {
            await inventoryManagerService.deactivateItem(id, reason);
            fetchItems();
        } catch (err) {
            alert('Failed to deactivate item');
            console.error('Deactivate error:', err);
        }
    };

    // Run the reorder agent
    const handleRunAgent = async () => {
        setAgentRunning(true);
        setAgentResult(null);
        try {
            const response = await inventoryManagerService.runReorderAgent(true);
            if (response.success) {
                // Fetch the full draft details
                if (response.data?.draftId) {
                    const draftResponse = await inventoryManagerService.getDraftPurchaseRequest(response.data.draftId);
                    setAgentResult({
                        ...response.data,
                        draft: draftResponse.data || draftResponse,
                    });
                } else {
                    setAgentResult(response.data);
                }
                setShowAgentModal(true);
            } else {
                alert('Agent failed: ' + response.error);
            }
        } catch (err) {
            alert('Agent error: ' + (err.response?.data?.error || err.message));
            console.error('Agent error:', err);
        } finally {
            setAgentRunning(false);
        }
    };

    // Fulfill the draft (approve + update inventory)
    const handleFulfillDraft = async () => {
        if (!agentResult?.draftId) return;

        setFulfilling(true);
        try {
            const response = await inventoryManagerService.fulfillDraftPurchaseRequest(agentResult.draftId);
            if (response.success) {
                alert('✅ ' + response.message);
                setShowAgentModal(false);
                setAgentResult(null);
                // Refresh items to show updated stock
                fetchItems();
            } else {
                alert('Failed to fulfill: ' + response.error);
            }
        } catch (err) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        } finally {
            setFulfilling(false);
        }
    };

    const totalPages = Math.ceil(pagination.total / pagination.limit);

    return (
        <div className="item-master p-6 max-w-7xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button className="text-textSecondary hover:text-primary transition" onClick={() => navigate('/inventory')}>
                        ← Back
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-textPrimary">Inventory Master</h1>
                        <p className="text-textSecondary text-sm">Manage non-medicine inventory items</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        className={`bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:brightness-110 transition shadow-sm flex items-center gap-2 ${agentRunning ? 'opacity-75 cursor-not-allowed' : ''}`}
                        onClick={handleRunAgent}
                        disabled={agentRunning}
                    >
                        {agentRunning ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Running Agent...
                            </>
                        ) : (
                            <>
                                <Bot size={16} />
                                🤖 Run Agent
                            </>
                        )}
                    </button>
                    <button className="bg-surface dark:bg-stone-800 border border-slate-200 dark:border-stone-700 text-textSecondary px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-stone-700 transition shadow-sm flex items-center gap-2" onClick={fetchItems}>
                        <RefreshCcw size={16} /> Refresh
                    </button>
                    <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:brightness-110 transition shadow-sm" onClick={() => navigate('/inventory/items/new')}>
                        + Add New Item
                    </button>
                </div>
            </header>

            {/* Agent Result Modal */}
            {showAgentModal && agentResult && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bot size={24} />
                                    <div>
                                        <h2 className="text-xl font-bold">Reorder Draft Ready</h2>
                                        <p className="text-violet-200 text-sm">Draft #{agentResult.draftNumber}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAgentModal(false)}
                                    className="text-white/80 hover:text-white text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh]">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{agentResult.summary?.itemsIncluded || 0}</p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Items to Reorder</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-blue-600">₹{agentResult.summary?.totalCostIncluded?.toLocaleString() || 0}</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400">Total Cost</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-amber-600">{agentResult.summary?.itemsDeferred || 0}</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400">Deferred</p>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="border dark:border-stone-700 rounded-lg overflow-hidden">
                                <div className="bg-slate-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-textSecondary uppercase tracking-wider">
                                    Items to Restock
                                </div>
                                <div className="divide-y dark:divide-stone-700">
                                    {agentResult.draft?.withinBudgetItems?.map((item, idx) => (
                                        <div key={idx} className="px-3 py-2 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <Package size={14} className="text-indigo-500" />
                                                <span className="font-medium text-textPrimary">{item.itemName}</span>
                                                <span className="text-xs text-textSecondary">({item.itemCode})</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-emerald-600 font-mono font-bold">+{item.recommendedOrderQty}</span>
                                                <span className="text-xs text-textSecondary">₹{item.estimatedCost}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Explanation */}
                            {agentResult.draft?.explanationText && (
                                <div className="bg-slate-50 dark:bg-stone-800 p-3 rounded-lg text-sm text-textSecondary">
                                    {agentResult.draft.explanationText}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="border-t dark:border-stone-700 p-4 flex gap-3 justify-end bg-slate-50 dark:bg-stone-800">
                            <button
                                onClick={() => setShowAgentModal(false)}
                                className="px-4 py-2 border dark:border-stone-600 rounded-lg text-textSecondary hover:bg-slate-100 dark:hover:bg-stone-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFulfillDraft}
                                disabled={fulfilling}
                                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:brightness-110 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {fulfilling ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={16} />
                                        Approve & Restock
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* External Audit Panel (Top Banner) */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-black dark:to-stone-900 rounded-xl p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 p-2">
                    <ShieldCheck size={100} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-indigo-500/20 p-3 rounded-full">
                        <ShieldCheck size={24} className="text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">External Compliance Audit</h3>
                        <p className="text-slate-300 text-sm">Audited by <span className="text-white font-medium">ABC Healthcare Audits Pvt. Ltd.</span></p>
                    </div>
                </div>
                <div className="flex gap-8 relative z-10">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Last Audit</p>
                        <div className="flex items-center gap-2 font-mono font-medium">
                            <Calendar size={14} className="text-emerald-400" />
                            12 Dec 2025
                        </div>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Next Audit</p>
                        <div className="flex items-center gap-2 font-mono font-medium text-amber-300">
                            <Calendar size={14} />
                            12 Jun 2026
                        </div>
                    </div>
                    <div className="hidden md:block border-l border-white/10 pl-6">
                        <div className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 font-medium">
                            Status: Clean
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface dark:bg-surface-highlight p-4 rounded-xl shadow-sm border border-slate-100 dark:border-stone-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-4 w-full">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            className="w-full pl-4 pr-4 py-2 border border-slate-200 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                            placeholder="Search by item code or name..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>
                    <select
                        className="border border-slate-200 dark:border-stone-600 rounded-lg px-4 py-2 bg-slate-50 dark:bg-stone-800 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                        value={selectedCategory}
                        onChange={handleCategoryFilter}
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat._id} value={cat._id}>
                                {cat.categoryName}
                            </option>
                        ))}
                    </select>
                </div>
                <span className="text-sm font-medium text-textSecondary">
                    {pagination.total} items found
                </span>
            </div>

            {/* Items Table */}
            {loading ? (
                <div className="bg-surface dark:bg-surface-highlight p-12 rounded-xl text-center text-textSecondary">Loading items...</div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl text-center text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/20">{error}</div>
            ) : (
                <>
                    <div className="bg-surface dark:bg-surface-highlight rounded-xl shadow-sm border border-slate-100 dark:border-stone-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-textSecondary">
                                <thead className="bg-slate-50 dark:bg-stone-800 text-textSecondary uppercase tracking-wider text-xs border-b border-slate-100 dark:border-stone-700">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Item Code</th>
                                        <th className="px-6 py-4 font-semibold">Item Name</th>
                                        <th className="px-6 py-4 font-semibold">Category</th>
                                        <th className="px-6 py-4 font-semibold text-center">UOM</th>
                                        <th className="px-6 py-4 font-semibold text-right">Available</th>
                                        <th className="px-6 py-4 font-semibold text-right">Min Level</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold">Last Updated</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-stone-700">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-8 text-center text-textSecondary">
                                                No items found
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map(item => (
                                            <tr key={item._id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition-colors">
                                                <td className="px-6 py-4 font-mono font-medium text-textPrimary">{item.itemCode}</td>
                                                <td className="px-6 py-4 font-medium text-textPrimary">{item.itemName}</td>
                                                <td className="px-6 py-4">{item.category?.categoryName || '-'}</td>
                                                <td className="px-6 py-4 text-center">{item.uom}</td>
                                                <td className={`px-6 py-4 text-right font-bold ${item.totalQuantity <= (item.policy?.minLevel || item.reorderLevel) ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {item.totalQuantity}
                                                </td>
                                                <td className="px-6 py-4 text-right text-textSecondary">{item.policy?.minLevel || item.reorderLevel || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                        ${item.status === 'AVAILABLE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                            item.status === 'LOW_STOCK' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                                                item.status === 'OUT_OF_STOCK' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                                    'bg-gray-100 dark:bg-stone-800 text-gray-700 dark:text-stone-400'}`}>
                                                        {item.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-textSecondary">
                                                    {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                                            onClick={() => navigate(`/inventory/items/${item._id}/edit`)}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center bg-surface dark:bg-surface-highlight p-4 rounded-xl shadow-sm border border-slate-100 dark:border-stone-700">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                className="px-4 py-2 border border-slate-200 dark:border-stone-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-stone-700 transition text-textPrimary"
                            >
                                Previous
                            </button>
                            <span className="text-textSecondary">
                                Page {pagination.page} of {totalPages}
                            </span>
                            <button
                                disabled={pagination.page === totalPages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                className="px-4 py-2 border border-slate-200 dark:border-stone-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-stone-700 transition text-textPrimary"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ItemMaster;
