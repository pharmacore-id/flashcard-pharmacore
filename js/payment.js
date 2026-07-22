// ============================================================
//  PROCESS PAYMENT - QRIS VERSION
// ============================================================

const createPayment = functions.httpsCallable("createPayment");

const QRIS_EXPIRE_SECONDS = 600;
const QRIS_SIZE = 280;
const PAYMENT_SUCCESS_DELAY = 1500;

let paymentStatusUnsubscribe = null;

async function processPayment() {

  if (!selectedPlan || !selectedDuration) {
    alert("Please select a plan first.");
    return;
  }

  if (isPremiumActive()) {
    alert("You already have Premium access!");
    return;
  }

  if (selectedPlan === "book" && !hasValidCode) {
    alert("Please validate your access code first.");
    return;
  }

  const btn = document.getElementById("upgrade-pay-btn");
if (!btn) return;
  btn.disabled = true;
  btn.textContent = "Creating payment...";

  try {

    const response = await createPayment({
    userType: selectedPlan,
    plan: `${selectedDuration}_month`,
    accessCode:
        selectedPlan === "book"
            ? document.getElementById("upgrade-code-input").value.trim()
            : null
});
    const payment = response.data;

    closeUpgradeModal();

    showQrisModal(payment);
    startPaymentStatusListener(payment.orderId);

  } catch (err) {

    console.error(err);

    alert(
      "Payment failed\n\n" +
      (err.message || "Unknown error")
    );

  } finally {

    btn.disabled = false;

    updatePricingDisplay();

  }

}

function formatRupiah(amount) {
    return "Rp " + Number(amount).toLocaleString("id-ID");
}

function showQrisModal(result) {
  const modal = document.getElementById("qris-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  document.body.classList.add("payment-open");
  showPaymentView();

  const checkPaymentBtn = document.getElementById("check-payment-btn");

if (checkPaymentBtn) {
    checkPaymentBtn.onclick = () => {
        showCheckingView();
    };
}

  // Clear timer lama jika ada
  if (modal.dataset.timerInterval) {
    clearInterval(Number(modal.dataset.timerInterval));
  }

  // ===== Amount =====
  const amountEl = document.getElementById("qris-amount-display");
  if (amountEl) {
   amountEl.textContent = formatRupiah(result.amount);
  }

  // ===== Plan =====
  const planEl = document.getElementById("qris-plan-display");
  if (planEl) {
    const planLabel =
      selectedPlan === "book" ? "Book Buyer" : "Regular";

    planEl.textContent =
      `${planLabel} · ${selectedDuration} Months`;
  }

  // ===== QR =====
  const imageEl = document.getElementById("qris-image");
  const placeholderEl = document.getElementById("qris-placeholder");

  if (!imageEl || !placeholderEl) return;

  if (result.qrisImage && result.qrisImage.trim() !== "") {

    imageEl.src = result.qrisImage;
    imageEl.classList.remove("hidden");
    placeholderEl.classList.add("hidden");

  } else if (result.qrisCode && result.qrisCode.trim() !== "") {

    imageEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");

    placeholderEl.innerHTML = `
      <div style="display:flex;justify-content:center;padding:12px;">
        <div id="qrcode"></div>
      </div>
    `;

    const qrContainer = document.getElementById("qrcode");

    if (qrContainer) {

      qrContainer.innerHTML = "";

      new QRCode(qrContainer, {
        text: result.qrisCode,
       width: QRIS_SIZE,
        height: QRIS_SIZE,
        correctLevel: QRCode.CorrectLevel.H
      });
    }

  } else {

    imageEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");

    placeholderEl.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:42px;">💳</div>
        <p style="margin-top:10px;font-weight:600;">QRIS tidak tersedia</p>
      </div>
    `;

  }

  // ======================================================
// DOWNLOAD QR CARD
// ======================================================

const saveBtn = document.getElementById("download-qr-btn");

if (saveBtn) {

    saveBtn.onclick = async () => {

        // Isi data kartu download
        document.getElementById("download-plan").textContent =
            `${selectedPlan === "book" ? "Book Buyer" : "Regular"} • ${selectedDuration} Months`;

        document.getElementById("download-total").textContent =
            formatRupiah(result.amount);

        document.getElementById("download-order").textContent =
            result.orderId || "-";

        const downloadImage =
            document.getElementById("download-qr-image");

        // Jika dari DOKU sudah berupa gambar
        if (result.qrisImage) {

            downloadImage.src = result.qrisImage;

        }

        // Jika hanya qrisCode
        else {

            const canvas =
                document.querySelector("#qrcode canvas");

            if (!canvas) {

                alert("QR Code belum tersedia.");
                return;

            }

            downloadImage.src = canvas.toDataURL("image/png");

        }

        await downloadQrisCard();

    };

}

  // ===== Countdown =====
 let seconds = QRIS_EXPIRE_SECONDS;
  const timerEl = document.getElementById("qris-countdown");

  if (timerEl) {

    timerEl.textContent = "10:00";

    const timerInterval = setInterval(() => {

      seconds--;

      if (seconds <= 0) {

        clearInterval(timerInterval);

        timerEl.textContent = "Expired";
        timerEl.style.background = "#6b7280";

        return;
      }

      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;

      timerEl.textContent =
        `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    }, 1000);

    modal.dataset.timerInterval = timerInterval;
  }

  // Refresh icon
  if (window.lucide?.createIcons) {
    lucide.createIcons();
  }
}

function startPaymentStatusListener(orderId) {

  // Stop listener lama
  if (paymentStatusUnsubscribe) {
    paymentStatusUnsubscribe();
    paymentStatusUnsubscribe = null;
  }

  paymentStatusUnsubscribe = db
    .collection("payments")
    .doc(orderId)
    .onSnapshot(async (doc) => {

      if (!doc.exists) return;

      const payment = doc.data();

      // ===== Payment Success =====
      if (payment.status === "paid") {

        if (paymentStatusUnsubscribe) {
          paymentStatusUnsubscribe();
          paymentStatusUnsubscribe = null;
        }

        // Ambil status premium terbaru
        const userDoc = await db
          .collection("users")
          .doc(currentUser)
          .get();

        if (userDoc.exists) {

          const userData = userDoc.data();

          userPlan = userData.plan || "premium";

          const expiry =
            userData.planExpiry?.toDate?.().toISOString() || null;

          savePlan(currentUser, userPlan, expiry);

        }

        updatePlanUI();
        updateHome();
        renderDecks();

       // Isi data di success view
document.getElementById("success-membership").textContent =
  "Premium";

document.getElementById("success-package").textContent =
  `${selectedPlan === "book" ? "Book" : "Regular"} • ${selectedDuration} Month${selectedDuration > 1 ? "s" : ""}`;

// Tampilkan halaman sukses
showSuccessView();

return;
      }

      // ===== Payment Failed / Expired =====
      if (
        payment.status === "failed" ||
        payment.status === "expired"
      ) {

       showPaymentView();

showToast(
  "Pembayaran gagal atau telah kedaluwarsa.",
  "error"
);

      }

    }, (error) => {

      console.error("Payment status listener error:", error);

    });

}


// ============================================================
// CLOSE QRIS MODAL
// ============================================================

function closeQrisModal() {

  const modal = document.getElementById("qris-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  document.body.classList.remove("payment-open");

  // Stop countdown
  if (modal.dataset.timerInterval) {
    clearInterval(Number(modal.dataset.timerInterval));
    delete modal.dataset.timerInterval;
  }

  // Stop Firestore listener
  if (paymentStatusUnsubscribe) {
    paymentStatusUnsubscribe();
    paymentStatusUnsubscribe = null;
  }

  // Reset QR image
  const image = document.getElementById("qris-image");
  if (image) {
    image.classList.add("hidden");
    image.src = "";
  }

  // Reset placeholder
  const placeholder = document.getElementById("qris-placeholder");

  if (placeholder) {
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:42px;">💳</div>
      </div>
    `;
  }
  showPaymentView();

}

const paymentView=document.getElementById("qris-payment-view");
const checkingView=document.getElementById("qris-checking-view");
const successView=document.getElementById("qris-success-view");

function showPaymentView(){

    paymentView.classList.remove("hidden");
    checkingView.classList.add("hidden");
    successView.classList.add("hidden");

}

function showCheckingView(){

    paymentView.classList.add("hidden");
    checkingView.classList.remove("hidden");
    successView.classList.add("hidden");

}

function showSuccessView(){

    paymentView.classList.add("hidden");
    checkingView.classList.add("hidden");
    successView.classList.remove("hidden");

}

document.getElementById("success-close-btn").onclick = () => {

    closeQrisModal();

};

async function downloadQrisCard(){

    const card=document.getElementById("download-card");

    const canvas=await html2canvas(card,{
        scale:3,
        backgroundColor:"#ffffff"
    });

    const link=document.createElement("a");

    link.download=`PHARMADECK_QRIS_${Date.now()}.png`;

    link.href=canvas.toDataURL("image/png");

    link.click();

}

