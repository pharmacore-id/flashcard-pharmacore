// ============================================================
//  PREMIUM / PLAN
// ============================================================

const validateAccessCodeCallable =
    functions.httpsCallable("validateAccessCode");

const redeemGiftCodeCallable =
    functions.httpsCallable("redeemGiftCode");

const ACTIVE_BORDER_COLOR = "#d97706";
const DEFAULT_BORDER_COLOR = "var(--border)";


// ============================================================
//  SAVE / LOAD PLAN
// ============================================================

async function savePlan(email, plan, expiry) {

    if (!email) return;

    // ============================
    // LOCAL STORAGE CACHE
    // ============================

    localStorage.setItem(
        "Pharmadeck_plan_" + email,
        plan
    );

    if (expiry) {
        localStorage.setItem(
            "Pharmadeck_expiry_" + email,
            expiry
        );
    } else {
        localStorage.removeItem(
            "Pharmadeck_expiry_" + email
        );
    }

    // ============================
    // MEMORY
    // ============================

    userPlan = plan;

    // ============================
    // INDEXEDDB CACHE
    // ============================

    try {

        const cached =
            await loadFromIndexedDB(email);

        if (cached) {

            await saveToIndexedDB(email, {
                ...cached,
                plan: plan,
                planExpiry: expiry || null
            });

        }

        console.log(
            "💎 Plan cache updated:",
            plan,
            expiry
        );

    } catch (error) {

        console.warn(
            "⚠️ Failed to update plan cache:",
            error
        );
    }
}

function getPlanExpiry(email) {
    return (
        localStorage.getItem(
            "Pharmadeck_expiry_" + email
        ) || null
    );
}


function isPremiumActive() {

    if (isAdmin) return true;

    if (userPlan !== "premium") {
        return false;
    }

    const expiry =
        getPlanExpiry(currentUser);

    if (!expiry) {
        return false;
    }

    return new Date(expiry) > new Date();
}


// ============================================================
//  FREE TRIAL
// ============================================================

function showFreeTrial() {

    const modal =
        document.getElementById("free-trial-modal");

    if (modal) {
        modal.classList.remove("hidden");
    }

    if (
        typeof lucide !== "undefined" &&
        lucide.createIcons
    ) {
        lucide.createIcons();
    }
}


function closeFreeTrial() {

    const modal =
        document.getElementById("free-trial-modal");

    if (modal) {
        modal.classList.add("hidden");
    }
}


function startFreeTrial() {

    closeFreeTrial();

    if (!currentUser) {
        showSignup();
        return;
    }

    switchTab("home");
}


// ============================================================
//  UPDATE PLAN UI
// ============================================================

function updatePlanUI() {

    const isPremium = isPremiumActive();
    const isAdminUser = isAdmin;


    // ======================
    // Top badge
    // ======================

    const badge =
        document.getElementById("plan-badge");

    if (badge) {

        if (isAdminUser) {

            badge.className = "hidden";

        } else if (isPremium) {

            badge.className = "premium-badge";
            badge.textContent = "PRO";

        } else {

            badge.className = "free-badge";
            badge.textContent = "FREE";
        }
    }


    // ======================
    // Settings plan label
    // ======================

    const planLabel =
        document.getElementById(
            "settings-plan-label"
        );

    if (planLabel) {

        if (isAdminUser) {

            planLabel.textContent =
                "Admin 👑";

        } else if (isPremium) {

            const expiry =
                getPlanExpiry(currentUser);

            const days =
                expiry
                    ? daysUntil(expiry)
                    : 0;

            planLabel.textContent =
                `Premium ✦ (${days} days left)`;

        } else {

            planLabel.textContent = "Free";
        }
    }


    // ======================
    // Upgrade button
    // ======================

    const upgradeBtn =
        document.getElementById(
            "settings-upgrade-btn"
        );

    if (upgradeBtn) {

        upgradeBtn.style.display =
            (isPremium || isAdminUser)
                ? "none"
                : "inline-block";
    }


    // ======================
    // Expiry
    // ======================

    const expiryLabel =
        document.getElementById(
            "expiry-label"
        );

    if (expiryLabel) {

        if (isAdminUser) {

            expiryLabel.textContent =
                "Permanent";

            expiryLabel.className =
                "status premium";

        } else if (isPremium) {

            const expiry =
                getPlanExpiry(currentUser);

            expiryLabel.textContent =
                expiry
                    ? formatExpiryDate(expiry)
                    : "Permanent";

            expiryLabel.className =
                "status premium";

        } else {

            expiryLabel.textContent =
                "Not active";

            expiryLabel.className =
                "status free";
        }
    }


    // ======================
    // Feature labels
    // ======================

    const premiumEnabled =
        isPremium || isAdminUser;


    const deckLimitLabel =
        document.getElementById(
            "deck-limit-label"
        );

    if (deckLimitLabel) {

        deckLimitLabel.textContent =
            premiumEnabled
                ? "♾️ All decks"
                : "Free decks only";

        deckLimitLabel.className =
            `status ${
                premiumEnabled
                    ? "premium"
                    : "free"
            }`;
    }


    const modeLabel =
        document.getElementById(
            "mode-limit-label"
        );

    if (modeLabel) {

        modeLabel.textContent =
            premiumEnabled
                ? "✅ All modes"
                : "Flashcards only";

        modeLabel.className =
            `status ${
                premiumEnabled
                    ? "premium"
                    : "free"
            }`;
    }


    const srsLabel =
        document.getElementById(
            "srs-limit-label"
        );

    if (srsLabel) {

        srsLabel.textContent =
            premiumEnabled
                ? "✅ Advanced"
                : "Basic";

        srsLabel.className =
            `status ${
                premiumEnabled
                    ? "premium"
                    : "free"
            }`;
    }


    const analyticsLabel =
        document.getElementById(
            "analytics-limit-label"
        );

    if (analyticsLabel) {

        analyticsLabel.textContent =
            premiumEnabled
                ? "✅ Full"
                : "Limited";

        analyticsLabel.className =
            `status ${
                premiumEnabled
                    ? "premium"
                    : "free"
            }`;
    }


    // ======================
    // Inputs
    // ======================

    const easeInput =
        document.getElementById(
            "ease-input"
        );

    const intervalInput =
        document.getElementById(
            "interval-input"
        );


    if (easeInput) {

        easeInput.disabled =
            !premiumEnabled;

        easeInput.style.opacity =
            premiumEnabled
                ? "1"
                : "0.5";
    }


    if (intervalInput) {

        intervalInput.disabled =
            !premiumEnabled;

        intervalInput.style.opacity =
            premiumEnabled
                ? "1"
                : "0.5";
    }


    // ======================
    // Premium lock
    // ======================

    const lockMsg =
        document.getElementById(
            "premium-lock-msg"
        );

    if (lockMsg) {

        lockMsg.classList.toggle(
            "hidden",
            premiumEnabled
        );
    }


    // ======================
    // Home upgrade prompt
    // ======================

    const prompt =
        document.getElementById(
            "home-upgrade-prompt"
        );

    if (prompt) {

        prompt.style.display =
            premiumEnabled
                ? "none"
                : "flex";
    }
}


// ============================================================
//  UPGRADE & PAYMENT
// ============================================================

function showUpgradeModal() {

    if (isPremiumActive()) {
        return;
    }

    const modal =
        document.getElementById("upgrade-modal");

    if (!modal) return;

    modal.classList.remove("hidden");


    const codeInput =
        document.getElementById(
            "upgrade-code-input"
        );

    const codeStatus =
        document.getElementById(
            "upgrade-code-status"
        );

    if (codeInput) {
        codeInput.value = "";
    }

    if (codeStatus) {
        codeStatus.textContent = "";
    }


    hasValidCode = false;
    selectedPlan = null;
    selectedDuration = 3;


    // ======================
    // Reset duration buttons
    // ======================

    document
        .querySelectorAll(
            ".upgrade-duration-btn"
        )
        .forEach(btn => {
            btn.classList.remove("active");
        });


    const defaultDuration =
        document.querySelector(
            '.upgrade-duration-btn[onclick*="selectDuration(3"]'
        );

    if (defaultDuration) {
        defaultDuration.classList.add("active");
    }


    // ======================
    // Reset plan borders
    // ======================

    const bookCard =
        document.getElementById(
            "book-buyer-card"
        );

    const regularCard =
        document.getElementById(
            "regular-card"
        );

    if (bookCard) {
        bookCard.style.borderColor =
            DEFAULT_BORDER_COLOR;
    }

    if (regularCard) {
        regularCard.style.borderColor =
            DEFAULT_BORDER_COLOR;
    }


    // ======================
    // Premium status
    // ======================

    const isPremium =
        isPremiumActive();


    if (isPremium) {

        const priceDisplay =
            document.getElementById(
                "modal-price-display"
            );

        const priceLabel =
            document.getElementById(
                "modal-price-label"
            );

        if (priceDisplay) {
            priceDisplay.textContent =
                "✅ Premium Active";
        }

        if (priceLabel) {
            priceLabel.textContent =
                "You already have premium!";
        }

    } else {

        selectedPlan = "book";
        selectedDuration = 3;

        updatePricingDisplay();
    }


    // ======================
    // Current plan label
    // ======================

    const currentPlanLabel =
        document.getElementById(
            "upgrade-current-plan"
        );

    if (currentPlanLabel) {

        currentPlanLabel.textContent =
            isPremium
                ? "Premium ✦"
                : "Free";

        currentPlanLabel.className =
            isPremium
                ? "premium-badge"
                : "free-badge";
    }


    if (isPremium && codeStatus) {

        codeStatus.textContent =
            "✅ You already have Premium access!";

        codeStatus.style.color =
            "#059669";
    }


    if (
        typeof lucide !== "undefined" &&
        lucide.createIcons
    ) {
        lucide.createIcons();
    }
}


function closeUpgradeModal() {

    const modal =
        document.getElementById(
            "upgrade-modal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }
}


// ============================================================
//  VALIDATE ACCESS CODE
// ============================================================

async function validateUpgradeCode() {

    const input =
        document.getElementById(
            "upgrade-code-input"
        );

    const status =
        document.getElementById(
            "upgrade-code-status"
        );

    if (!input || !status) return;


    const code =
        input.value
            .trim()
            .toUpperCase();


    if (!code) {

        hasValidCode = false;

        status.textContent =
            "Please enter access code";

        status.style.color =
            "#ef4444";

        updatePricingDisplay();

        return;
    }


    try {

        status.textContent =
            "⏳ Validating...";

        status.style.color =
            "#6b7280";


        const result =
            await validateAccessCodeCallable({
                code
            });


        if (!result.data.valid) {

            hasValidCode = false;

            status.textContent =
                "❌ " +
                (
                    result.data.message ||
                    "Invalid access code"
                );

            status.style.color =
                "#ef4444";

            updatePricingDisplay();

            return;
        }


        hasValidCode = true;

        status.textContent =
            "✅ Access code verified";

        status.style.color =
            "#10b981";

        updatePricingDisplay();


    } catch (error) {

        console.error(
            "Access code validation error:",
            error
        );

        hasValidCode = false;

        status.textContent =
            "❌ " +
            (
                error.message ||
                "Validation error"
            );

        status.style.color =
            "#ef4444";

        updatePricingDisplay();
    }
}

// ============================================================
//  REDEEM GIFT CODE
// ============================================================

async function redeemGiftCode() {

    const input =
        document.getElementById("gift-code-input");

    const status =
        document.getElementById("gift-code-status");

    const button =
        document.getElementById("gift-code-btn");

    if (!input || !status) return;

    const code =
        input.value
            .trim()
            .toUpperCase();

    if (!code) {
        status.textContent =
            "Please enter a gift code.";

        status.style.color =
            "#ef4444";

        return;
    }

    try {

        if (button) {
            button.disabled = true;
            button.textContent = "Redeeming...";
        }

        status.textContent =
            "⏳ Checking gift code...";

        status.style.color =
            "#6b7280";

        const result =
            await redeemGiftCodeCallable({
                code
            });

        if (!result.data?.success) {
            throw new Error(
                result.data?.message ||
                "Failed to redeem gift code"
            );
        }

       const expiry =
    result.data.expiresAt;

        // Update local frontend state
        await savePlan(
    currentUser,
    "premium",
    expiry
);

        status.textContent =
            "🎉 Gift code redeemed! Premium activated for 1 month.";

        status.style.color =
            "#059669";

        input.value = "";

        updatePlanUI();

        setTimeout(() => {
            status.textContent =
                expiry
                    ? `Premium active until ${formatExpiryDate(expiry)}`
                    : "Premium activated!";
        }, 1200);

    } catch (error) {

        console.error(
            "Gift code redemption error:",
            error
        );

        status.textContent =
            "❌ " +
            (
                error.message ||
                "Failed to redeem gift code"
            );

        status.style.color =
            "#ef4444";

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "Redeem";
        }
    }
}

// ============================================================
//  SELECT PLAN
// ============================================================

function selectPlan(type) {

    if (isPremiumActive()) {

        alert(
            "You already have Premium access!"
        );

        return;
    }


    selectedPlan = type;


    const bookCard =
        document.getElementById(
            "book-buyer-card"
        );

    const regularCard =
        document.getElementById(
            "regular-card"
        );


    if (bookCard) {

        bookCard.style.borderColor =
            type === "book"
                ? ACTIVE_BORDER_COLOR
                : DEFAULT_BORDER_COLOR;
    }


    if (regularCard) {

        regularCard.style.borderColor =
            type === "regular"
                ? ACTIVE_BORDER_COLOR
                : DEFAULT_BORDER_COLOR;
    }


    // ======================
    // Access code
    // ======================

    const accessSection =
        document.getElementById(
            "access-code-section"
        );


    if (type === "book") {

        if (accessSection) {
            accessSection.classList.remove(
                "hidden"
            );
        }

    } else {

        if (accessSection) {
            accessSection.classList.add(
                "hidden"
            );
        }


        const codeInput =
            document.getElementById(
                "upgrade-code-input"
            );

        const codeStatus =
            document.getElementById(
                "upgrade-code-status"
            );


        if (codeInput) {
            codeInput.value = "";
        }

        if (codeStatus) {
            codeStatus.textContent = "";
        }

        hasValidCode = false;
    }


    updatePricingDisplay();
}


// ============================================================
//  SELECT DURATION
// ============================================================

function selectDuration(months, event) {

    selectedDuration =
        Number(months);


    document
        .querySelectorAll(
            ".upgrade-duration-btn"
        )
        .forEach(btn => {
            btn.classList.remove("active");
        });


    if (event?.currentTarget) {

        event.currentTarget.classList.add(
            "active"
        );
    }


    updatePricingDisplay();
}


// ============================================================
//  UPDATE PRICING DISPLAY
// ============================================================

function updatePricingDisplay() {

    if (
        !selectedPlan ||
        !selectedDuration
    ) {
        return;
    }


    const duration =
        Number(selectedDuration);


    const salePrice =
        PRICING[selectedPlan]?.[duration];


    const normalPrice =
        NORMAL_PRICING[selectedPlan]?.[duration];


    if (!salePrice) {

        console.warn(
            "⚠️ Pricing not found:",
            selectedPlan,
            duration
        );

        return;
    }


    const formatPrice =
        amount =>
            "Rp" +
            Number(amount)
                .toLocaleString("id-ID");


    // ============================================================
    // DISCOUNT
    // ============================================================

    let discountPercent = 0;


    if (
        normalPrice &&
        normalPrice > salePrice
    ) {

        discountPercent =
            Math.round(
                (
                    (normalPrice - salePrice) /
                    normalPrice
                ) * 100
            );
    }


    // ============================================================
    // PRICE DISPLAY
    // ============================================================

    const priceEl =
        document.getElementById(
            "modal-price-display"
        );


    if (priceEl) {

        if (discountPercent > 0) {

            priceEl.innerHTML = `
                <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                ">

                    <span style="
                        font-size:15px;
                        font-weight:500;
                        text-decoration:line-through;
                        opacity:.5;
                    ">
                        ${formatPrice(normalPrice)}
                    </span>

                    <span style="
                        font-size:30px;
                        font-weight:800;
                    ">
                        ${formatPrice(salePrice)}
                    </span>

                    <span style="
                        font-size:11px;
                        font-weight:700;
                        background:#dcfce7;
                        color:#15803d;
                        padding:3px 7px;
                        border-radius:999px;
                    ">
                        SAVE ${discountPercent}%
                    </span>

                </div>
            `;

        } else {

            priceEl.textContent =
                formatPrice(salePrice);
        }
    }


    // ============================================================
    // LABEL
    // ============================================================

    const planLabel =
        selectedPlan === "book"
            ? "Book Buyer"
            : "Regular";


    const labelEl =
        document.getElementById(
            "modal-price-label"
        );


    if (labelEl) {

        labelEl.textContent =
            `${planLabel} · ${duration} Month${
                duration > 1
                    ? "s"
                    : ""
            }`;
    }


    // ============================================================
    // PRICE PER DAY
    // ============================================================

    const days =
        duration * 30;


    const perDay =
        Math.round(
            salePrice / days
        );


    const dailyEl =
        document.getElementById(
            "price-per-day"
        );


    if (dailyEl) {

        dailyEl.textContent =
            `${formatPrice(perDay)}/day`;
    }

   // ============================================================
// PAYMENT BUTTON
// ============================================================

const payBtn =
    document.getElementById("upgrade-pay-btn");

if (payBtn) {

    const codeRequired =
        selectedPlan === "book";

    const codeValid =
        hasValidCode === true;

    if (codeRequired && !codeValid) {

        payBtn.textContent =
            "Please validate code first";

        payBtn.disabled = true;

        payBtn.style.opacity = "0.5";
        payBtn.style.cursor = "not-allowed";

    } else {

        payBtn.textContent =
            `Pay ${formatPrice(salePrice)}`;

        payBtn.disabled = false;

        payBtn.style.opacity = "1";
        payBtn.style.cursor = "pointer";
    }
}
}

// ============================================================
// PREMIUM COMPARISON COUNTS
// ============================================================

function updatePremiumComparison() {

    try {

        // ----------------------------------------------------
        // TOTAL CARDS
        // ----------------------------------------------------

        const totalCards =
            Array.isArray(allCards)
                ? allCards.length
                : 0;


        // ----------------------------------------------------
        // DECKS
        //
        // Sesuaikan dengan struktur deck yang digunakan app.
        // ----------------------------------------------------

        let totalDecks = 0;
        let freeDecks = 0;

        let freeCards = 0;


        /*
         * Jika data deck tersedia sebagai sharedDecks.
         */
        if (Array.isArray(window.sharedDecks)) {

            const decks =
                window.sharedDecks;


            totalDecks =
                decks.length;


            freeDecks =
                decks.filter(deck => {

                    return (
                        deck.premium !== true &&
                        deck.isPremium !== true
                    );

                }).length;


            /*
             * Hitung cards dari deck FREE.
             */
            decks.forEach(deck => {

                const isPremiumDeck =
                    deck.premium === true ||
                    deck.isPremium === true;


                if (!isPremiumDeck) {

                    if (Array.isArray(deck.cards)) {

                        freeCards +=
                            deck.cards.length;

                    }

                }

            });

        }


        // ----------------------------------------------------
        // FALLBACK
        //
        // Kalau sharedDecks belum tersedia,
        // jangan tampilkan angka palsu.
        // ----------------------------------------------------

        if (!totalDecks) {

            const deckElements =
                document.querySelectorAll(
                    "[data-deck-id]"
                );

            if (deckElements.length) {

                totalDecks =
                    deckElements.length;

            }

        }


        // ----------------------------------------------------
        // PREMIUM CARDS
        // ----------------------------------------------------

        const premiumCards =
            totalCards;


        // Kalau freeCards tidak berhasil dihitung
        // dari struktur deck, gunakan 0 agar tidak misleading.
        if (!Number.isFinite(freeCards)) {
            freeCards = 0;
        }


        // ----------------------------------------------------
        // UPDATE UI
        // ----------------------------------------------------

        const freeDeckEl =
            document.getElementById(
                "comparison-free-decks"
            );

        const premiumDeckEl =
            document.getElementById(
                "comparison-premium-decks"
            );

        const freeCardsEl =
            document.getElementById(
                "comparison-free-cards"
            );

        const premiumCardsEl =
            document.getElementById(
                "comparison-premium-cards"
            );


        if (freeDeckEl) {

            freeDeckEl.textContent =
                `Free (${freeDecks})`;

        }


        if (premiumDeckEl) {

            premiumDeckEl.textContent =
                `All (${totalDecks})`;

        }


        if (freeCardsEl) {

            freeCardsEl.textContent =
                `Free (${freeCards})`;

        }


        if (premiumCardsEl) {

            premiumCardsEl.textContent =
                `All (${premiumCards})`;

        }


        console.log(
            "📊 Premium comparison:",
            {
                freeDecks,
                totalDecks,
                freeCards,
                premiumCards
            }
        );


    } catch (error) {

        console.warn(
            "⚠️ Failed to update premium comparison:",
            error
        );

    }

}
