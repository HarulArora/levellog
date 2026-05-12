import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isLoading }) => {
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-[#111118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Top Accent Line */}
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {title || 'Delete Confirmation'}
                                </h3>
                                <p className="text-[#7a7a90] text-sm leading-relaxed font-mono">
                                    {message || 'Are you sure you want to delete this? This action cannot be undone and will permanently remove the data from the pond.'}
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-1 text-[#3a3a4a] hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-stretch gap-3 mt-8">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-[#7a7a90] font-bold text-sm rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 text-center flex items-center justify-center"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className="flex-1 px-4 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-center"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Delete Permanently'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Decoration */}
                    <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-center">
                        <div className="flex items-center gap-1.5 opacity-20">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="font-mono text-[10px] text-white tracking-[0.3em] uppercase">Permanent Action</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default DeleteConfirmModal;
