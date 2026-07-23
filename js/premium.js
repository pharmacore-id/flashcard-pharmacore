const validateAccessCodeCallable =
    functions.httpsCallable("validateAccessCode");

const ACTIVE_BORDER_COLOR = "#d97706";
const DEFAULT_BORDER_COLOR = "var(--border)";

 function savePlan(email, plan, expiry) {
    localStorage.setItem("Pharmadeck_plan_" + email, plan);

    if (expiry) {
        localStorage.setItem("Pharmadeck_expiry_" + email, expiry);
    } else {
        localStorage.removeItem("Pharmadeck_expiry_" + email);
    }

    userPlan = plan;
}


  function getPlanExpiry(email) {
      return localStorage.getItem('Pharmadeck_expiry_' + email) || null;
    }

   function isPremiumActive() {
  if (isAdmin) return true;
  if (userPlan !== 'premium') return false;
  const expiry = getPlanExpiry(currentUser);
  if (!expiry) return true; 
  return new Date(expiry) > new Date();
}

 function showFreeTrial() {
      document.getElementById('free-trial-modal').classList.remove('hidden');
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function closeFreeTrial() { document.getElementById('free-trial-modal').classList.add('hidden') }

    function startFreeTrial() {
      closeFreeTrial();
      if (!currentUser) {
        showSignup();
        return;
      }
      switchTab('home');
    }

  function updatePlanUI() {

    const isPremium = isPremiumActive();
    const isAdminUser = isAdmin;

    // ======================
    // Top badge
    // ======================

    const badge =
        document.getElementById('plan-badge');

    if (badge) {

        if (isAdminUser) {

            badge.className =
                'hidden';

        } else if (isPremium) {

            badge.className =
                'premium-badge';

            badge.textContent =
                'PRO';

        } else {

            badge.className =
                'free-badge';

            badge.textContent =
                'FREE';

        }
    }

    // ======================
    // Settings plan label
    // ======================

    const planLabel =
        document.getElementById(
            'settings-plan-label'
        );

    if (planLabel) {

        if (isAdminUser) {

            planLabel.textContent =
                'Admin 👑';

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

            planLabel.textContent =
                'Free';
        }
    }

    // ======================
    // Upgrade button
    // ======================

    const upgradeBtn =
        document.getElementById(
            'settings-upgrade-btn'
        );

    if (upgradeBtn) {

        upgradeBtn.style.display =
            (isPremium || isAdminUser)
            ? 'none'
            : 'inline-block';
    }

    // ======================
    // Expiry
    // ======================

    const expiryLabel =
        document.getElementById(
            'expiry-label'
        );

    if (expiryLabel) {

        if (isAdminUser) {

            expiryLabel.textContent =
                'Permanent';

            expiryLabel.className =
                'status premium';

        } else if (isPremium) {

            const expiry =
                getPlanExpiry(currentUser);

            expiryLabel.textContent =
                expiry
                ? formatExpiryDate(expiry)
                : 'Permanent';

            expiryLabel.className =
                'status premium';

        } else {

            expiryLabel.textContent =
                'Not active';

            expiryLabel.className =
                'status free';
        }
    }

    // ======================
    // Feature labels
    // ======================

    const premiumEnabled =
        isPremium || isAdminUser;

    const deckLimitLabel =
        document.getElementById(
            'deck-limit-label'
        );

    if (deckLimitLabel) {

        deckLimitLabel.textContent =
            premiumEnabled
            ? '♾️ All decks'
            : 'Free decks only';

        deckLimitLabel.className =
            `status ${
                premiumEnabled
                ? 'premium'
                : 'free'
            }`;
    }

    const modeLabel =
        document.getElementById(
            'mode-limit-label'
        );

    if (modeLabel) {

        modeLabel.textContent =
            premiumEnabled
            ? '✅ All modes'
            : 'Flashcards only';

        modeLabel.className =
            `status ${
                premiumEnabled
                ? 'premium'
                : 'free'
            }`;
    }

    const srsLabel =
        document.getElementById(
            'srs-limit-label'
        );

    if (srsLabel) {

        srsLabel.textContent =
            premiumEnabled
            ? '✅ Advanced'
            : 'Basic';

        srsLabel.className =
            `status ${
                premiumEnabled
                ? 'premium'
                : 'free'
            }`;
    }

    const analyticsLabel =
        document.getElementById(
            'analytics-limit-label'
        );

    if (analyticsLabel) {

        analyticsLabel.textContent =
            premiumEnabled
            ? '✅ Full'
            : 'Limited';

        analyticsLabel.className =
            `status ${
                premiumEnabled
                ? 'premium'
                : 'free'
            }`;
    }

    // ======================
    // Inputs
    // ======================

    const easeInput =
        document.getElementById(
            'ease-input'
        );

    const intervalInput =
        document.getElementById(
            'interval-input'
        );

    if (easeInput) {
        easeInput.disabled =
            !premiumEnabled;

        easeInput.style.opacity =
            premiumEnabled
            ? '1'
            : '0.5';
    }

    if (intervalInput) {
        intervalInput.disabled =
            !premiumEnabled;

        intervalInput.style.opacity =
            premiumEnabled
            ? '1'
            : '0.5';
    }

    const lockMsg =
        document.getElementById(
            'premium-lock-msg'
        );

    if (lockMsg) {
        lockMsg.classList.toggle(
            'hidden',
            premiumEnabled
        );
    }

    const prompt =
        document.getElementById(
            'home-upgrade-prompt'
        );

    if (prompt) {

        prompt.style.display =
            premiumEnabled
            ? 'none'
            : 'flex';
    }
}

 // ============================================================
    //  UPGRADE & PAYMENT
    // ============================================================
    function showUpgradeModal() {
      document.getElementById('upgrade-modal').classList.remove('hidden');
      document.getElementById('upgrade-code-input').value = '';
      document.getElementById('upgrade-code-status').textContent = '';
      hasValidCode = false;
      selectedPlan = null;
        selectedDuration = 3;
        document.querySelectorAll('.upgrade-duration-btn').forEach(btn => {
    btn.classList.remove('active');
});

document.querySelector('.upgrade-duration-btn[onclick*="selectDuration(3"]')
    ?.classList.add('active');
     document.getElementById("book-buyer-card").style.borderColor =
    DEFAULT_BORDER_COLOR;
document.getElementById("regular-card").style.borderColor =
    DEFAULT_BORDER_COLOR;

      const isPremium = isPremiumActive();
      if (isPremium) {
    document.getElementById('modal-price-display').textContent =
        '✅ Premium Active';

    document.getElementById('modal-price-label').textContent =
        'You already have premium!';
} else {
    selectedPlan = "book";
    selectedDuration = 3;
    updatePricingDisplay();
}

      const currentPlanLabel = document.getElementById('upgrade-current-plan');
      if (currentPlanLabel) {
        currentPlanLabel.textContent = isPremium ? 'Premium ✦' : 'Free';
        currentPlanLabel.className = isPremium ? 'premium-badge' : 'free-badge';
      }

      if (isPremium) {
        const status = document.getElementById('upgrade-code-status');
        status.textContent = '✅ You already have Premium access!';
        status.style.color = '#059669';
      }

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function closeUpgradeModal() { document.getElementById('upgrade-modal').classList.add('hidden') }

 async function validateUpgradeCode() {
  const code = document
    .getElementById('upgrade-code-input')
    .value
    .trim()
    .toUpperCase();

  const status = document.getElementById('upgrade-code-status');

  if (!code) {
    hasValidCode = false;
    status.textContent = 'Please enter access code';
    status.style.color = '#ef4444';
    updatePricingDisplay();
    return;
  }

  try {
    status.textContent = '⏳ Validating...';
    status.style.color = '#6b7280';

   const result =
    await validateAccessCodeCallable({ code });

    if (!result.data.valid) {
      hasValidCode = false;
      status.textContent = '❌ ' + (result.data.message || 'Invalid access code');
      status.style.color = '#ef4444';
      updatePricingDisplay();
      return;
    }

    hasValidCode = true;
    status.textContent = '✅ Access code verified';
    status.style.color = '#10b981';
    updatePricingDisplay();

  } catch (error) {
    console.error('Access code validation error:', error);

    hasValidCode = false;
    status.textContent =
      '❌ ' + (error.message || 'Validation error');
    status.style.color = '#ef4444';

    updatePricingDisplay();
  }
}
    
function selectPlan(type){

    if(isPremiumActive()){
        alert("You already have Premium access!");
        return;
    }

    selectedPlan = type;

    document
        .getElementById("book-buyer-card")
        .style.borderColor =
            type === "book"
                ? ACTIVE_BORDER_COLOR
                : DEFAULT_BORDER_COLOR;

    document
        .getElementById("regular-card")
        .style.borderColor =
            type === "regular"
                ? ACTIVE_BORDER_COLOR
                : DEFAULT_BORDER_COLOR;

    // ===== Show / Hide Access Code =====
    const accessSection = document.getElementById("access-code-section");

    if (type === "book") {
        accessSection.classList.remove("hidden");
    } else {
        accessSection.classList.add("hidden");

        document.getElementById("upgrade-code-input").value = "";
        document.getElementById("upgrade-code-status").textContent = "";
        hasValidCode = false;
    }

    updatePricingDisplay();

}

function selectDuration(months,event){

selectedDuration=months;

document
.querySelectorAll('.upgrade-duration-btn')
.forEach(btn=>{

btn.classList.remove('active');

});

event.currentTarget.classList.add('active');

updatePricingDisplay();

}

function updatePricingDisplay(){

if (!selectedPlan || !selectedDuration) {
    return;
}

const price=
PRICING[selectedPlan][selectedDuration];

const perDay=
Math.round(
price/(selectedDuration*30)
);

const label =
selectedPlan === "book"
    ? "BOOK BUYER"
    : "REGULAR";

document
.getElementById("modal-price-label")
.textContent =
label;

document
.getElementById(
'price-per-day'
)
.textContent=
`Rp${perDay.toLocaleString()}/day`;

const payBtn=
document.getElementById(
'upgrade-pay-btn'
);

payBtn.textContent=
`Pay Rp${price.toLocaleString()}`;


// Disable payment for book buyer until token valid

if(
selectedPlan==="book"
&& !hasValidCode
){

payBtn.disabled=true;

payBtn.style.opacity=".5";

payBtn.textContent=
'Validate access code first';

}
else{

payBtn.disabled=false;

payBtn.style.opacity="1";}}

