function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {} } catch { return {} } }

    function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)) }

    function getCodes() { try { return JSON.parse(localStorage.getItem(CODES_KEY)) || {} } catch { return {} } }

    function saveCodes(c) { localStorage.setItem(CODES_KEY, JSON.stringify(c)) }
