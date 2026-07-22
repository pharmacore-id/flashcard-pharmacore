// ============================================================
//  SHARED DECKS CACHE
// ============================================================

let sharedDecksCache = null;

function hasSharedDeckCache() {
    return Array.isArray(sharedDecksCache);
}

async function loadSharedDecksOnce() {
    console.time('⏱️ sharedDecks.total');
    console.log('🔍 loadSharedDecksOnce: START');
    
    if (hasSharedDeckCache()) {
        console.log('📚 Using cached shared decks:', sharedDecksCache.length);
        console.timeEnd('⏱️ sharedDecks.total');
        return {
            cards: sharedDecksCache,
            deckVersions: deckVersionsCache || {}
        };
    }
    
    try {
        console.log('🔍 loadSharedDecksOnce: calling loadSharedDecks()...');
        const result = await loadSharedDecks();
        
        console.log('🔍 DEBUG result:', result);
        console.log('🔍 DEBUG isArray:', Array.isArray(result));
        
        let cards = [];
        let deckVersions = {};
        
        if (Array.isArray(result)) {
            cards = result;
            console.log('🔍 loadSharedDecksOnce: result is ARRAY, length =', cards.length);
        } else if (result && typeof result === 'object' && Array.isArray(result.cards)) {
            cards = result.cards || [];
            deckVersions = result.deckVersions || {};
            console.log('🔍 loadSharedDecksOnce: result is OBJECT, cards.length =', cards.length);
        } else {
            console.warn('⚠️ loadSharedDecksOnce: unknown result format', result);
        }
        
        sharedDecksCache = cards;
        deckVersionsCache = deckVersions;
        
        console.log('📚 Shared decks loaded:', sharedDecksCache.length, 'cards');
        console.timeEnd('⏱️ sharedDecks.total');
        return {
            cards: sharedDecksCache,
            deckVersions: deckVersionsCache
        };
        
    } catch (error) {
        console.error('⚠️ Shared decks load failed:', error);
        console.timeEnd('⏱️ sharedDecks.total');
        return { cards: [], deckVersions: {} };
    }
}

function invalidateSharedDeckCache() {
    sharedDecksCache = null;
    console.log('🔄 Shared deck cache invalidated');
}

// ============================================================
//  SHARED DECKS - SAVE & LOAD
// ============================================================

async function saveSharedDeck(deckData, isPremium = false) {
  if (!isAdmin) return;
  try {
    const docRef = db.collection('sharedDecks').doc();
    await docRef.set({
      deckName: deckData.deckName,
      topic: deckData.topic || 'General',
      subtopic: deckData.subtopic || '',
      isPremium: isPremium,
      cards: deckData.cards.map(c => ({
        card_id: c.card_id,
        card_front: c.card_front,
        card_back: c.card_back,
        card_tags: c.card_tags || '',
        card_background: c.card_background || ''
        // ===== TIDAK ADA PROGRESS DI SINI! =====
      })),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser
    });
    return true;
  } catch (error) {
    console.error('❌ Gagal menyimpan shared deck:', error);
    return false;
  }
}

  async function loadSharedDecks() {
    console.log('🔍 loadSharedDecks: START');
    
    try {
        const snapshot = await db.collection('sharedDecks').get();
        console.log('🔍 sharedDecks snapshot size:', snapshot.size);
        
        const sharedCards = [];

        snapshot.forEach(doc => {
            const deck = doc.data();
            const deckId = doc.id;
            const deckName = deck.deckName || 'Shared Deck';
            const topic = deck.topic || 'General';
            const subtopic = deck.subtopic || '';
            const isPremium = deck.isPremium || false;
            const version = deck.version || 0;
            
            // ============================================================
            //  AMBIL CARDS DARI DECK
            // ============================================================
            const cards = deck.cards || [];
            
            if (cards.length > 0) {
                console.log(`📚 Deck ${deckId}: ${cards.length} cards`);
                
                cards.forEach(c => {
                    const cardId = c.card_id || c.id || null;
                    if (!cardId) {
                        console.warn('⚠️ Card without ID in deck', deckId);
                        return;
                    }
                    
                    sharedCards.push({
                        __id: 'shared_' + deckId + '_' + cardId,
                        card_id: cardId,
                        deck_id: 'shared_' + deckId,
                        deck_name: deckName,
                        topic: topic,
                        subtopic: subtopic,
                        isPremium: isPremium,
                        card_front: c.card_front || c.front || c.question || '',
                        card_back: c.card_back || c.back || c.answer || '',
                        card_tags: c.card_tags || c.tags || '',
                        card_background: c.card_background || c.background || '',
                        isShared: true,
                        deckVersion: version
                    });
                });
            }
        });

        console.log('🔍 sharedCards built:', sharedCards.length);
        return sharedCards;

    } catch (error) {
        console.error('❌ loadSharedDecks: ERROR', error);
        return [];
    }
}
    
   async function updateSharedDeck(deckId, deckData, isPremium = false) {
  if (!isAdmin) return false;
  try {
    const docRef = db.collection('sharedDecks').doc(deckId);
    await docRef.update({
      deckName: deckData.deckName,
      topic: deckData.topic || 'General',
      subtopic: deckData.subtopic || '',
      isPremium: isPremium,
      cards: deckData.cards.map(c => ({
        card_id: c.card_id,
        card_front: c.card_front,
        card_back: c.card_back,
        card_tags: c.card_tags || '',
        card_background: c.card_background || ''
        // ===== TIDAK ADA PROGRESS DI SINI! =====
      })),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Gagal update shared deck:', error);
    return false;
  }
}
