import mongoose from 'mongoose';

/**
 * Runs a function within a transaction with automatic retries for transient errors.
 * @param {Function} fn - Function to run within transaction. Receives session as argument.
 */
export const runInTransaction = async (fn) => {
    const session = await mongoose.startSession();
    let retries = 3;
    
    while (retries > 0) {
        try {
            session.startTransaction();
            const result = await fn(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            
            // Check if it's a transient transaction error (e.g. WriteConflict)
            const isTransient = error.errorLabels && error.errorLabels.includes('TransientTransactionError');
            
            if (isTransient && retries > 1) {
                retries--;
                console.warn(`Transient transaction error, retrying... (${retries} retries left)`);
                // Optional: small delay
                await new Promise(resolve => setTimeout(resolve, 50 * (3 - retries)));
                continue;
            }
            throw error;
        } finally {
            if (retries === 1 || !session.inTransaction()) {
                // Only end if we're not retrying
            }
        }
    }
    session.endSession();
};

// Alternative: Use session.withTransaction() which has built-in retry logic
export const withRetryTransaction = async (fn) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async (s) => {
            result = await fn(s);
        });
        return result;
    } finally {
        session.endSession();
    }
};
