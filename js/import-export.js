function importExcelToDeck(event) {
  if (!isAdmin || !manageDeckId) {
    alert('Only admins can import, or no deck selected.');
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    alert('❌ Excel library not loaded. Please refresh and try again.');
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      if (jsonData.length === 0) {
        alert('No data found in Excel file.');
        return;
      }

      let importedCount = 0;
      const deck = allCards.find(c => c.deck_id === manageDeckId && c.card_front === '__deck_placeholder__');

      jsonData.forEach(row => {
        const front = row['Front'] || row['front'] || row['QUESTION'] || row['question'];
        const back = row['Back'] || row['back'] || row['ANSWER'] || row['answer'];

        if (!front || !back) return;

        const exists = allCards.some(c =>
          c.deck_id === manageDeckId &&
          c.card_front === front &&
          c.card_back === back
        );

        if (exists) return;

        allCards.push({
          __id: generateId(),
          deck_id: manageDeckId,
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

        importedCount++;
      });

      saveUserData(currentUser)
        .catch(console.error);

      renderManageCards();
      renderDecks();

      alert(`✅ Imported ${importedCount} new cards to this deck!`);

    } catch (error) {
      alert('❌ Error importing file: ' + error.message);
      console.error(error);
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}


async function handleExcelImport(event) {
  if (!isAdmin) {
    alert('Only admins can import decks.');
    return;
  }

  const file = event.target.files[0];
  if (!file) {
    alert('No file selected.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('❌ Excel library not loaded. Please refresh and try again.');
    return;
  }

  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        showImportStatus('❌ No sheets found in Excel file.', 'error');
        return;
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (jsonData.length === 0) {
        showImportStatus('❌ No data found in Excel file.', 'error');
        return;
      }

      const isPremium = document.getElementById('import-premium-toggle').checked;
      console.log('📌 Import dengan status premium:', isPremium);

      const missingIds = jsonData.filter(row => {
        const id = row['ID'] || row['id'] || row['Id'];
        return id === undefined || id === null || id === '';
      });

      if (missingIds.length > 0) {
        showImportStatus(`❌ Error: ${missingIds.length} baris memiliki ID kosong. ID wajib diisi!`, 'error');
        return;
      }

      let newCards = 0;
      let updatedCards = 0;
      let duplicateCards = 0;
      let skippedCount = 0;
      let newDecks = 0;
      let updatedDecks = 0;

      const decksToImport = {};

      jsonData.forEach((row) => {
        const id = parseInt(row['ID'] || row['id'] || row['Id']);
        const topic = row['Topic'] || row['topic'] || row['TOPIC'] || 'General';
        const subtopic = row['Subtopic'] || row['subtopic'] || row['SUBTOPIC'] || '';
        const front = row['Front'] || row['front'] || row['FRONT'] || row['Question'] || row['question'] || row['QUESTION'];
        const back = row['Back'] || row['back'] || row['BACK'] || row['Answer'] || row['answer'] || row['ANSWER'];
        const tags = row['Tags'] || row['tags'] || row['TAGS'] || '';
        const background = row['Background'] || row['background'] || row['BACKGROUND'] || '';

        if (!front || !back) {
          skippedCount++;
          return;
        }

        if (isNaN(id) || id < 1) {
          skippedCount++;
          console.warn(`⚠️ ID tidak valid: ${id}`);
          return;
        }

        const deckName = topic + (subtopic ? ' - ' + subtopic : '');
        const deckKey = deckName;

        if (!decksToImport[deckKey]) {
          decksToImport[deckKey] = {
            deckName: deckName,
            topic: topic,
            subtopic: subtopic,
            cards: []
          };
        }

        decksToImport[deckKey].cards.push({
          card_id: id,
          card_front: front,
          card_back: back,
          card_tags: tags,
          card_background: background
        });
      });

      if (skippedCount > 0) {
        console.warn(`⚠️ ${skippedCount} baris dilewati (data tidak lengkap atau ID tidak valid)`);
      }

      for (const deckKey in decksToImport) {
        const deck = decksToImport[deckKey];
        const deckName = deck.deckName;

        const existingDocs = await db.collection('sharedDecks')
          .where('deckName', '==', deckName)
          .get();

        if (existingDocs.empty) {

          console.log(`📁 Membuat deck baru: ${deckName}`);

          const success = await saveSharedDeck({
            deckName: deckName,
            topic: deck.topic,
            subtopic: deck.subtopic,
            cards: deck.cards
          }, isPremium);

          if (success) {
            newDecks++;
            newCards += deck.cards.length;
          }

        } else {

          const docRef = existingDocs.docs[0].ref;
          const docId = existingDocs.docs[0].id;
          const docData = existingDocs.docs[0].data();

          let existingCards = docData.cards || [];

          let cardsToAdd = [];
          let cardsToUpdate = [];

          for (const newCard of deck.cards) {
            const cardId = newCard.card_id;
            const existing = existingCards.find(c => c.card_id === cardId);

            if (existing) {

              const normalizeText = (text) => {
                return String(text || '')
                  .replace(/\u00A0/g, ' ')
                  .replace(/\r\n/g, '\n')
                  .replace(/\r/g, '\n')
                  .replace(/\s+/g, ' ')
                  .trim();
              };

              const oldFront = normalizeText(existing.card_front);
              const oldBack = normalizeText(existing.card_back);

              const newFront = normalizeText(newCard.card_front);
              const newBack = normalizeText(newCard.card_back);

              if (oldFront === newFront && oldBack === newBack) {
                duplicateCards++;
                continue;
              }

              console.log(`🔄 Update kartu ID ${cardId} di deck ${deckName}`);

              updatedCards++;

              const updatedCard = {
                ...existing,
                card_front: newCard.card_front,
                card_back: newCard.card_back,
                card_tags: newCard.card_tags || existing.card_tags || '',
                card_background: newCard.card_background || existing.card_background || '',
                updatedAt: new Date().toISOString()
              };

              cardsToUpdate.push(updatedCard);

            } else {

              console.log(`➕ Tambah kartu baru ID ${cardId} di deck ${deckName}`);

              cardsToAdd.push({
                card_id: newCard.card_id,
                card_front: newCard.card_front,
                card_back: newCard.card_back,
                card_tags: newCard.card_tags || '',
                card_background: newCard.card_background || ''
              });

              newCards++;
            }
          }

          let finalCards = [...existingCards];

          if (cardsToUpdate.length > 0) {
            const updateIds = new Set(cardsToUpdate.map(c => c.card_id));

            finalCards = finalCards.map(c => {
              if (updateIds.has(c.card_id)) {
                return cardsToUpdate.find(u => u.card_id === c.card_id) || c;
              }
              return c;
            });
          }

          if (cardsToAdd.length > 0) {
            finalCards = [...finalCards, ...cardsToAdd];
          }

          await updateSharedDeck(docId, {
            deckName: deckName,
            topic: deck.topic,
            subtopic: deck.subtopic,
            cards: finalCards
          }, isPremium);

          updatedDecks++;

          console.log(`✅ Deck diperbarui: ${deckName}`);
        }
      }

      const progressMap = new Map();
      allCards.forEach(card => {
        if (card.isShared) {
          const key = card.__id || card.card_id;
          progressMap.set(key, {
            ease_factor: card.ease_factor,
            interval: card.interval,
            repetitions: card.repetitions,
            total_reviews: card.total_reviews,
            correct_count: card.correct_count,
            next_review: card.next_review,
            last_review: card.last_review,
            review_history: card.review_history || []
          });
        }
      });

      const sharedCards = await loadSharedDecks();

      const mergedSharedCards = sharedCards.map(card => {
        const key = card.__id || card.card_id;
        const progress = progressMap.get(key);
        return progress ? { ...card, ...progress } : card;
      });

      const customCards = allCards.filter(c => !c.isShared);

      allCards = [...customCards, ...mergedSharedCards];

      await saveUserData(currentUser);

      renderDecks();
      updateHome();
      renderAdminDeckList();

      let message = `✅ Import selesai!\n\n`;
      message += `📁 Deck baru: ${newDecks}\n`;
      message += `📝 Deck diupdate: ${updatedDecks}\n`;
      message += `🆕 Kartu baru: ${newCards}\n`;
      message += `🔄 Kartu diupdate: ${updatedCards}\n`;
      message += `⏭️ Kartu duplikat (di-skip): ${duplicateCards}\n`;

      if (skippedCount > 0) {
        message += `⚠️ Baris dilewati: ${skippedCount} (data tidak lengkap)\n`;
      }

      showImportStatus(message, 'success');
      alert(message);

    } catch (error) {
      console.error('❌ Import error:', error);
      showImportStatus('❌ Error importing file: ' + error.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}
    function showImportStatus(message, type) {
      const statusDiv = document.getElementById('import-status');
      const statusBox = document.getElementById('import-status-box');
      const statusText = document.getElementById('import-status-text');

      if (!statusDiv || !statusBox || !statusText) {
        console.log('📊 Import status:', message);
        if (type === 'success') {
          alert('✅ ' + message);
        } else {
          alert('❌ ' + message);
        }
        return;
      }

      statusDiv.classList.remove('hidden');
      statusText.textContent = message;

      if (type === 'success') {
        statusBox.className =
          'flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800';
        const icon = statusBox.querySelector('i');
        if (icon) {
          icon.className = 'w-5 h-5 text-green-500';
          icon.setAttribute('data-lucide', 'check-circle');
        }
      } else {
        statusBox.className =
          'flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
        const icon = statusBox.querySelector('i');
        if (icon) {
          icon.className = 'w-5 h-5 text-red-500';
          icon.setAttribute('data-lucide', 'alert-circle');
        }
      }

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }

      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }

 function downloadSampleExcel() {
  const sampleData = [
    { 
      ID: 1,
      Topic: 'Pharmacy', 
      Subtopic: 'Basics', 
      Front: 'What is a drug?', 
      Back: 'A substance that alters body function',
      Tags: 'pharmacology',
      Background: ''
    },
    { 
      ID: 2,
      Topic: 'Pharmacy', 
      Subtopic: 'Dosage', 
      Front: 'What is 1 gram in mg?', 
      Back: '1000 mg',
      Tags: 'calculations',
      Background: ''
    },
    { 
      ID: 3,
      Topic: 'Science', 
      Subtopic: 'Biology', 
      Front: 'What is DNA?', 
      Back: 'Deoxyribonucleic acid',
      Tags: 'genetics',
      Background: ''
    },
    { 
      ID: 4,
      Topic: 'Languages', 
      Subtopic: 'Spanish', 
      Front: 'Hello', 
      Back: 'Hola',
      Tags: 'greetings',
      Background: ''
    },
    { 
      ID: 5,
      Topic: 'History', 
      Subtopic: 'World History', 
      Front: 'When did WWII end?', 
      Back: '1945',
      Tags: 'war',
      Background: ''
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Flashcards');
  XLSX.writeFile(wb, 'Pharmadeck_sample_decks.xlsx');
}

 function exportData() {
      const blob = new Blob([JSON.stringify(allCards, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pharmadeck-export-' + today() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }

 // ============================================================
    //  ACCESS CODES (ADMIN)
    // ============================================================
   async function generateCodes(count) {
  if (!isAdmin) return;
  
  const prefix = 'PC';
  const year = new Date().getFullYear();
  let generated = 0;

  for (let i = 0; i < count; i++) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}-${year}-${random}`;
    
    try {
      const existing = await db.collection('accessCodes').doc(code).get();
      
      if (!existing.exists) {
        await db.collection('accessCodes').doc(code).set({
          code: code,
          used: false,
          usedBy: null,
          usedAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: currentUser
        });
        generated++;
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
    }
  }
  
  alert(`✅ Generated ${generated} new access codes!`);
  renderCodeList();
}

  async function exportCodes() {
  if (!isAdmin) return;

  try {
    const snapshot = await db.collection('accessCodes').get();
    
    if (snapshot.empty) {
      alert('No codes to export. Generate some first!');
      return;
    }

    const data = [];
    snapshot.forEach(doc => {
      const c = doc.data();
      data.push({
        Code: c.code,
        Used: c.used ? 'Yes' : 'No',
        'Used By': c.usedBy || '',
        'Used At': c.usedAt?.toDate?.() || c.usedAt || '',
        'Created At': c.createdAt?.toDate?.() || c.createdAt || ''
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Access Codes');
    XLSX.writeFile(wb, 'Pharmadeck_access_codes.xlsx');
  } catch (error) {
    console.error('Export error:', error);
    alert('❌ Failed to export codes.');
  }
}
