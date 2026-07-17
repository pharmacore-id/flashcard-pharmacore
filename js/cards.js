 function showManageCards(deckId) {
      if (!isAdmin) {
        alert('Only admins can manage cards.');
        return;
      }

      manageDeckId = deckId;
      const deck = allCards.find(c => c.deck_id === deckId && c.card_front === '__deck_placeholder__');
      const deckName = deck ? deck.deck_name : 'Manage Cards';
      document.getElementById('manage-deck-name').textContent = deckName;

      selectedCardIds = [];
      const selectAll = document.getElementById('select-all-cards');
      if (selectAll) selectAll.checked = false;
      const deleteBtn = document.getElementById('delete-selected-cards-btn');
      if (deleteBtn) deleteBtn.disabled = true;
      const countLabel = document.getElementById('selected-cards-count');
      if (countLabel) countLabel.textContent = '0 selected';

      const bulkBtn = document.getElementById('bulk-delete-cards-btn');
      if (bulkBtn) bulkBtn.classList.remove('hidden');

      document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
      });

      const adminCardsView = document.getElementById('view-admin-cards');
      if (adminCardsView) {
        adminCardsView.classList.add('active');
        adminCardsView.style.display = 'flex';
      }

      currentTab = 'admin-cards';
      renderManageCards();

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function renderManageCards() {
      const container = document.getElementById('manage-cards-list');
      if (!container) return;

      const cards = allCards.filter(c => c.deck_id === manageDeckId && c.card_front !== '__deck_placeholder__');

      if (cards.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10">
            <p class="text-sec text-sm">No cards in this deck.</p>
            <button onclick="showAddCardToDeck()" class="mt-3 accent-bg text-white px-4 py-2 rounded-xl text-sm font-medium">Add First Card</button>
          </div>
        `;
        return;
      }

      selectedCardIds = [];

      container.innerHTML = cards.map((c, i) => `
          <div class="card-item surface rounded-2xl p-3 border border-theme shadow-card mb-2 flex items-center gap-3">
            <input type="checkbox" class="card-checkbox" data-card-id="${c.__id}" onchange="toggleCardSelection('${c.__id}', this)" />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">${c.card_front || 'Empty'}</p>
              <p class="text-xs text-sec truncate">→ ${c.card_back || 'Empty'}</p>
              <div class="text-[10px] text-sec mt-0.5">
                Reviews: ${c.total_reviews || 0} · Correct: ${c.correct_count || 0}
              </div>
            </div>
            <div class="flex gap-1 flex-shrink-0">
              <button onclick="showEditCard('${c.__id}')" class="text-sec p-1 hover:text-accent transition-colors" title="Edit Card">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button onclick="deleteCard('${c.__id}')" class="text-sec p-1 hover:text-red-500 transition-colors" title="Delete Card">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `).join('');

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

 function toggleCardSelection(cardId, checkbox) {
      if (checkbox.checked) {
        if (!selectedCardIds.includes(cardId)) {
          selectedCardIds.push(cardId);
        }
      } else {
        selectedCardIds = selectedCardIds.filter(id => id !== cardId);
      }
      updateCardSelectionUI();
    }

    function toggleAllCards() {
      const checkboxes = document.querySelectorAll('.card-checkbox');
      const isChecked = document.getElementById('select-all-cards').checked;

      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const cardId = cb.dataset.cardId;
        if (isChecked) {
          if (!selectedCardIds.includes(cardId)) {
            selectedCardIds.push(cardId);
          }
        } else {
          selectedCardIds = selectedCardIds.filter(id => id !== cardId);
        }
      });
      updateCardSelectionUI();
    }

    function updateCardSelectionUI() {
      const count = selectedCardIds.length;
      document.getElementById('selected-cards-count').textContent = count + ' selected';
      document.getElementById('delete-selected-cards-btn').disabled = count === 0;

      const totalCheckboxes = document.querySelectorAll('.card-checkbox').length;
      const checkedCheckboxes = document.querySelectorAll('.card-checkbox:checked').length;
      document.getElementById('select-all-cards').checked = totalCheckboxes > 0 && checkedCheckboxes === totalCheckboxes;
    }

    function deleteSelectedCards() {
      if (selectedCardIds.length === 0) {
        alert('No cards selected.');
        return;
      }

      if (!confirm(`Delete ${selectedCardIds.length} selected cards?`)) return;

      allCards = allCards.filter(c => !selectedCardIds.includes(c.__id));
      saveUserData(currentUser)
  .catch(console.error);
      selectedCardIds = [];
      renderManageCards();
      renderDecks();
      updateHome();
      document.getElementById('select-all-cards').checked = false;
      document.getElementById('delete-selected-cards-btn').disabled = true;
      document.getElementById('selected-cards-count').textContent = '0 selected';
      alert('✅ Selected cards deleted successfully!');
    }

    function showAddCardToDeck() {
      if (!isAdmin || !manageDeckId) return;
      addingToDeckId = manageDeckId;
      document.getElementById('card-front-input').value = '';
      document.getElementById('card-back-input').value = '';
      document.getElementById('card-modal').classList.remove('hidden');
    }

    function saveCard() {
      const front = document.getElementById('card-front-input').value.trim();
      const back = document.getElementById('card-back-input').value.trim();
      if (!front || !back) return;

      const deck = allCards.find(c => c.deck_id === addingToDeckId && c.card_front === '__deck_placeholder__');
      allCards.push({
        __id: generateId(),
        deck_id: addingToDeckId,
        deck_name: deck ? deck.deck_name : 'Untitled',
        card_front: front,
        card_back: back,
        card_tags: '',
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review: today(),
        last_review: '',
        total_reviews: 0,
        correct_count: 0
      });
      saveUserData(currentUser)
  .catch(console.error);
      closeCardModal();
      renderManageCards();
      renderDecks();
      updateHome();
    }

    function closeCardModal() {
      document.getElementById('card-modal').classList.add('hidden');
    }

 function showEditCard(cardId) {
      if (!isAdmin) return;
      editCardId = cardId;
      const card = allCards.find(c => c.__id === cardId);
      if (!card) return;
      document.getElementById('edit-card-front').value = card.card_front || '';
      document.getElementById('edit-card-back').value = card.card_back || '';
      document.getElementById('edit-card-modal').classList.remove('hidden');
      setTimeout(() => document.getElementById('edit-card-front').focus(), 100);
    }

    function closeEditCard() {
      document.getElementById('edit-card-modal').classList.add('hidden');
    }

    function saveEditCard() {
      const front = document.getElementById('edit-card-front').value.trim();
      const back = document.getElementById('edit-card-back').value.trim();
      if (!front || !back || !editCardId) return;

      const card = allCards.find(c => c.__id === editCardId);
      if (card) {
        card.card_front = front;
        card.card_back = back;
        saveUserData(currentUser)
  .catch(console.error);
        closeEditCard();
        renderManageCards();
        renderDecks();
        updateHome();
        alert('✅ Card updated successfully!');
      }
    }

    function deleteCard(cardId) {
      if (!isAdmin) return;
      if (!confirm('Delete this card?')) return;
      allCards = allCards.filter(c => c.__id !== cardId);
      saveUserData(currentUser)
  .catch(console.error);
      renderManageCards();
      renderDecks();
      updateHome();
    }
