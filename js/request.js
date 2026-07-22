// ============================================================
    //  CONTACT ADMIN
    // ============================================================
    function showContactAdmin() {
      document.getElementById('contact-admin-modal').classList.remove('hidden');
      document.getElementById('request-topic').value = '';
      document.getElementById('request-subtopic').value = '';
      document.getElementById('request-notes').value = '';
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function closeContactAdmin() {
      document.getElementById('contact-admin-modal').classList.add('hidden');
    }

  async function sendDeckRequest(e) {
  e.preventDefault();
  const topic = document.getElementById('request-topic').value.trim();
  const subtopic = document.getElementById('request-subtopic').value.trim();
  const notes = document.getElementById('request-notes').value.trim();

  if (!topic) {
    alert('Please enter a topic.');
    return;
  }

  try {
    await db.collection('deckRequests').add({
      user: currentUser || 'anonymous',
      topic: topic,
      subtopic: subtopic,
      notes: notes,
      date: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    alert('✅ Request sent! Mincore will review it soon.');
    closeContactAdmin();
  } catch (error) {
    console.error('Failed to send request:', error);
    alert('❌ Failed to send request. Please try again.');
  }
}
