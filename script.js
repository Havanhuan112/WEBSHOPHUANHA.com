/***********************************************************
 * Hệ thống Thông Báo (Notification)
 ***********************************************************/
function showNotification(type, message) {
  const container = document.getElementById("notificationContainer");
  const notification = document.createElement("div");
  notification.classList.add("notification", type);
  notification.innerHTML = `<i class="${getIcon(type)}"></i> ${message}`;
  container.appendChild(notification);

  // Hiệu ứng xuất hiện
  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  // Tự động ẩn sau 3 giây
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function getIcon(type) {
  switch (type) {
    case "success":
      return "fas fa-check-circle";
    case "error":
      return "fas fa-times-circle";
    case "warning":
      return "fas fa-exclamation-triangle";
    case "info":
      return "fas fa-info-circle";
    default:
      return "fas fa-info-circle";
  }
}

/***********************************************************
 * Hiệu ứng Marquee cho chữ chạy
 ***********************************************************/
const marqueeTextElement = document.getElementById("marquee-text");
const marqueeTextContent = "Shop Huấn Hà Uy Tín Số 1 Việt Nam ";
let marqueeIndex = 0;
function typeMarquee() {
  marqueeTextElement.innerText = marqueeTextContent.substring(0, marqueeIndex);
  marqueeIndex++;
  if (marqueeIndex > marqueeTextContent.length) {
    marqueeIndex = 0;
  }
  setTimeout(typeMarquee, 150);
}
typeMarquee();

/***********************************************************
 * Chuyển đổi giữa form Đăng ký & Đăng nhập
 ***********************************************************/
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const switchToLogin = document.getElementById("switchToLogin");
const switchToSignup = document.getElementById("switchToSignup");

switchToLogin.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  clearMessage();
});
switchToSignup.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  clearMessage();
});
function clearMessage() {
  document.getElementById("authMessage").textContent = "";
}

/***********************************************************
 * Đăng ký / Đăng nhập với Firebase
 ***********************************************************/
const authMessage = document.getElementById("authMessage");
const btnSignUp = document.getElementById("btnSignUp");
const btnLogin = document.getElementById("btnLogin");

btnSignUp.addEventListener("click", async () => {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    authMessage.style.color = "#66ff66";
    authMessage.textContent = "Đăng ký thành công! Vui lòng chờ...";
    showNotification("success", "Đăng ký thành công!");
    // Tạo tên user ngẫu nhiên và lưu vào Database
    const randomUsername = "User" + Math.floor(Math.random() * 100000);
    await firebase.database().ref('users/' + user.uid).set({
      username: randomUsername,
      email: user.email,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
  } catch (error) {
    authMessage.style.color = "#ff6666";
    authMessage.textContent = "Lỗi: " + error.message;
    showNotification("error", "Lỗi đăng ký: " + error.message);
  }
});

btnLogin.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    authMessage.style.color = "#66ff66";
    authMessage.textContent = "Đăng nhập thành công! Vui lòng chờ...";
    showNotification("success", "Đăng nhập thành công!");
  } catch (error) {
    authMessage.style.color = "#ff6666";
    authMessage.textContent = "Lỗi: " + error.message;
    showNotification("error", "Lỗi đăng nhập: " + error.message);
  }
});

/***********************************************************
 * Theo dõi trạng thái đăng nhập (onAuthStateChanged)
 ***********************************************************/
const authSection = document.getElementById("authSection");
const shopSection = document.getElementById("shopSection");
const btnLogout = document.getElementById("btnLogout");

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    authSection.classList.add("hidden");
    shopSection.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
    // Lấy tên user từ Database và hiển thị
    firebase.database().ref('users/' + user.uid + '/username').once('value')
      .then(snapshot => {
        const username = snapshot.val();
        document.getElementById("userName").textContent = username;
        document.getElementById("userInfo").classList.remove("hidden");
      });
  } else {
    authSection.classList.remove("hidden");
    shopSection.classList.add("hidden");
    btnLogout.classList.add("hidden");
    document.getElementById("userInfo").classList.add("hidden");
  }
});

/***********************************************************
 * Đăng xuất
 ***********************************************************/
btnLogout.addEventListener("click", async () => {
  await firebase.auth().signOut();
  showNotification("info", "Đã đăng xuất!");
});

/***********************************************************
 * Xử lý sự kiện “Mua Ngay” / “Chơi Ngay”
 ***********************************************************/
document.querySelectorAll('.btn-play').forEach((btn) => {
  btn.addEventListener('click', async function() {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert("Bạn cần đăng nhập trước!");
      return;
    }
    const productId = this.getAttribute('data-product');
    const downloadLink = this.getAttribute('data-download');
    this.disabled = true;
    
    // Hiển thị modal thanh toán
    showPaymentNotification(productId);
    
    // Tạo dữ liệu giao dịch
    const purchaseData = {
      status: false,
      bankInfo: "Ngân hàng Mbbank - STK: 0325575642 - Nội dung: Thanh toán " + productId,
      userEmail: user.email,
      purchaseTime: firebase.database.ServerValue.TIMESTAMP,
      productId: productId
    };
    const purchaseRef = firebase.database().ref('purchases/' + user.uid + '/' + productId);
    await purchaseRef.set(purchaseData);
    
    // Polling: Kiểm tra trạng thái giao dịch mỗi 3 giây
    const pollInterval = setInterval(() => {
      purchaseRef.once('value').then(snapshot => {
        const data = snapshot.val();
        if (data && data.status === true) {
          updatePaymentNotificationSuccess(productId, data, downloadLink);
          showNotification("success", "Thanh toán thành công cho sản phẩm " + productId);
          clearInterval(pollInterval);
        }
      });
    }, 3000);
  });
});

/***********************************************************
 * Hàm hiển thị modal thanh toán
 ***********************************************************/
function showPaymentNotification(productId) {
  const modal = document.getElementById('paymentNotification');
  const messageP = document.getElementById('paymentMessage');
  modal.classList.remove('hidden');
  messageP.innerHTML = `Vui lòng chuyển khoản đến:<br/>
    <strong>Ngân hàng Mbbank</strong><br/>
    Số tài khoản: <strong>0325575642</strong><br/>
    Nội dung chuyển khoản: <strong>${productId}</strong><br/>
    Email: <strong>${firebase.auth().currentUser.email}</strong><br/>
    <i class="fas fa-spinner fa-spin"></i> Đang xử lý...`;
  document.getElementById('closePaymentNotification').classList.add('hidden');
  // Ẩn nút download nếu có
  document.getElementById('downloadBtn').classList.add('hidden');
}

/***********************************************************
 * Hàm cập nhật modal thanh toán khi giao dịch thành công (status:true)
 * Thêm nút Download với link tải riêng
 ***********************************************************/
function updatePaymentNotificationSuccess(productId, data, downloadLink) {
  const modal = document.getElementById('paymentNotification');
  const messageP = document.getElementById('paymentMessage');
  
  // Chuyển đổi timestamp thành thời gian đọc được
  const purchaseTime = new Date(data.purchaseTime);
  const timeString = purchaseTime.toLocaleString();
  
  messageP.innerHTML = `<i class="fas fa-check"></i> Thanh toán thành công cho sản phẩm <strong>${productId}</strong><br/>
    Email: <strong>${data.userEmail}</strong><br/>
    Thời gian: <strong>${timeString}</strong>`;
  
  // Hiển thị nút Download với link tải cụ thể
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.href = downloadLink;
  downloadBtn.classList.remove('hidden');
  
  // Hiển thị nút Đóng modal
  document.getElementById('closePaymentNotification').classList.remove('hidden');
}

/***********************************************************
 * Đóng modal thanh toán khi nhấn nút “Đóng”
 ***********************************************************/
document.getElementById('closePaymentNotification').addEventListener('click', () => {
  document.getElementById('paymentNotification').classList.add('hidden');
});

/***********************************************************
 * Xử lý nút “Xem Lịch Sửa Mua Hàng”
 ***********************************************************/
document.getElementById('btnPurchaseHistory').addEventListener('click', async () => {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Bạn cần đăng nhập để xem lịch sử mua hàng!");
    return;
  }
  const historyRef = firebase.database().ref('purchases/' + user.uid);
  const snapshot = await historyRef.once('value');
  const historyData = snapshot.val();
  
  const historyListDiv = document.getElementById('purchaseHistoryList');
  historyListDiv.innerHTML = "";
  
  if (historyData) {
    Object.keys(historyData).forEach(productId => {
      const data = historyData[productId];
      const purchaseTime = new Date(data.purchaseTime);
      const timeString = purchaseTime.toLocaleString();
      const statusIcon = data.status ? '<i class="fas fa-check" style="color:#66ff66;"></i>' : '<i class="fas fa-spinner fa-spin" style="color:#ffcc00;"></i>';
      
      const itemDiv = document.createElement("div");
      itemDiv.classList.add("purchase-history-item");
      itemDiv.innerHTML = `
        <p><i class="fas fa-box"></i> Sản phẩm: <strong>${productId}</strong></p>
        <p><i class="fas fa-envelope"></i> Email: <strong>${data.userEmail}</strong></p>
        <p><i class="fas fa-university"></i> Ngân hàng: <strong>${data.bankInfo}</strong></p>
        <p><i class="fas fa-clock"></i> Thời gian: <strong>${timeString}</strong></p>
        <p>Trạng thái: <span class="status ${data.status ? "success" : "pending"}">${statusIcon} ${data.status ? "Thành công" : "Đang xử lý"}</span></p>
      `;
      historyListDiv.appendChild(itemDiv);
    });
  } else {
    historyListDiv.innerHTML = "<p>Không có giao dịch nào.</p>";
  }
  
  document.getElementById('purchaseHistoryModal').classList.remove('hidden');
});

/***********************************************************
 * Đóng modal lịch sử mua hàng khi nhấn nút “Đóng”
 ***********************************************************/
document.getElementById('closePurchaseHistory').addEventListener('click', () => {
  document.getElementById('purchaseHistoryModal').classList.add('hidden');
});
function toggleMenu() {
      document.getElementById("sidebar").classList.toggle("active");
    }

    function openWarning() {
      document.getElementById("warningBox").style.display = "block";
    }

    function closeWarning() {
      document.getElementById("warningBox").style.display = "none";
    }
  // thông báo 

      // Hiển thị thông báo tự động khi trang được tải

// đánh giá 5* 
document.addEventListener('DOMContentLoaded', function() {
  // --- Xử lý chọn số sao ---
  var stars = document.querySelectorAll('.rating .star');
  var selectedRating = 0;
  
  stars.forEach(function(star) {
    star.addEventListener('click', function() {
      selectedRating = this.getAttribute('data-value');
      updateStarSelection(selectedRating);
    });
    star.addEventListener('mouseover', function() {
      var hoverValue = this.getAttribute('data-value');
      updateStarHover(hoverValue);
    });
    star.addEventListener('mouseout', function() {
      updateStarSelection(selectedRating);
    });
  });
  
  function updateStarSelection(rating) {
    stars.forEach(function(star) {
      if (star.getAttribute('data-value') <= rating) {
        star.classList.add('selected');
      } else {
        star.classList.remove('selected');
      }
    });
  }
  
  function updateStarHover(hoverValue) {
    stars.forEach(function(star) {
      if (star.getAttribute('data-value') <= hoverValue) {
        star.classList.add('hovered');
      } else {
        star.classList.remove('hovered');
      }
    });
  }
  
  // --- Xử lý gửi đánh giá lên Firebase ---
  var reviewForm = document.getElementById('reviewForm');
  var reviewList = document.getElementById('reviewList');
  
  reviewForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var reviewText = document.getElementById('reviewText').value;
    // Lấy email người dùng từ Firebase Auth nếu đã đăng nhập, nếu không thì hiển thị "Khách vãng lai"
    var user = firebase.auth().currentUser;
    var email = user ? user.email : "Khách vãng lai";
    
    // Tạo đối tượng đánh giá
    var reviewObj = {
      email: email,
      rating: selectedRating,
      text: reviewText,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Lưu vào Firebase (nút 'reviews')
    firebase.database().ref('reviews').push(reviewObj)
      .then(function() {
        // Xóa form sau khi gửi
        reviewForm.reset();
        selectedRating = 0;
        updateStarSelection(0);
      })
      .catch(function(error) {
        console.error('Lỗi gửi đánh giá:', error);
      });
  });
  
  // --- Hàm hiển thị đánh giá ---
  // Hàm hiển thị đánh giá (bình luận) với ngày gửi
function displayReview(reviewId, reviewData) {
  var div = document.createElement('div');
  div.classList.add('review-item');

  // Tạo HTML hiển thị số sao
  var ratingHTML = '';
  for (var i = 1; i <= reviewData.rating; i++) {
    ratingHTML += '<i class="fa-solid fa-star"></i>';
  }
  for (var i = reviewData.rating; i < 5; i++) {
    ratingHTML += '<i class="fa-regular fa-star"></i>';
  }

  // Chuyển đổi timestamp thành định dạng ngày giờ dễ đọc
  var date = new Date(reviewData.timestamp);
  var formattedDate = date.toLocaleString(); // Bạn có thể thay đổi định dạng nếu cần

  // Hiển thị email, ngày gửi, đánh giá sao và nội dung bình luận
  div.innerHTML = `
    <div class="review-header">
      <div class="review-email">${reviewData.email}</div>
      <div class="review-date">${formattedDate}</div>
    </div>
    <div class="review-rating">${ratingHTML}</div>
    <div class="review-text">${reviewData.text}</div>
  `;

  reviewList.appendChild(div);
}
// --- Lắng nghe đánh giá mới từ Firebase ---
  firebase.database().ref('reviews').on('child_added', function(snapshot) {
    var reviewData = snapshot.val();
    displayReview(snapshot.key, reviewData);
  });
});

// chat  với huấn hà 
 // thông báo
document.addEventListener("DOMContentLoaded", function () {
  const accountInfoIcon = document.getElementById("accountInfoIcon");
  const accountInfoModal = document.getElementById("accountInfoModal");
  const accountInfoClose = document.getElementById("accountInfoClose");
  const accountEmailDisplay = document.getElementById("accountEmailDisplay");
  const accountPasswordDisplay = document.getElementById("accountPasswordDisplay");
  const accountRegisterTime = document.getElementById("accountRegisterTime");

  // Hàm mở modal và hiển thị thông tin tài khoản từ Firebase
  function openAccountInfoModal() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      alert("Bạn cần đăng nhập để xem thông tin tài khoản.");
      return;
    }
    // Lấy dữ liệu người dùng từ Firebase (giả sử dữ liệu được lưu tại node "users/{uid}" với các trường email, password, registerTime)
    firebase.database().ref("users/" + currentUser.uid).on("value", function (snapshot) {
      const userData = snapshot.val();
      if (userData) {
        accountEmailDisplay.textContent = userData.email;
        accountPasswordDisplay.textContent = userData.password; // Lưu ý: chỉ sử dụng cho demo; không nên lưu mật khẩu dưới dạng plaintext
        // Chuyển đổi timestamp thành định dạng ngày tháng năm dễ đọc
        const regTime = new Date(userData.registerTime);
        accountRegisterTime.textContent = regTime.toLocaleString(); // hoặc regTime.toLocaleDateString() cho chỉ ngày tháng năm
      }
    });
    accountInfoModal.classList.remove("acc-hidden");
    // Buộc trình duyệt render lại để hiệu ứng transition hoạt động
    void accountInfoModal.offsetWidth;
    accountInfoModal.classList.add("show");
  }

  accountInfoIcon.addEventListener("click", openAccountInfoModal);

  accountInfoClose.addEventListener("click", function () {
    accountInfoModal.classList.remove("show");
    setTimeout(function () {
      accountInfoModal.classList.add("acc-hidden");
    }, 300);
  });
});
// Thông Báo Wwb ⭐️
            // Lấy phần tử overlay và nút đóng
    const overlay = document.getElementById('notification-overlay');
    const closeBtn = overlay.querySelector('.close-btn');
    
    // Hàm ẩn overlay với hiệu ứng
    function hideOverlay() {
      overlay.classList.add('hide');
      // Sau khi hiệu ứng hoàn thành (0.5 giây), ẩn hoàn toàn overlay khỏi flow trang
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
    
    // Khi nhấn nút tắt, ẩn overlay
    closeBtn.addEventListener('click', hideOverlay);
// Trang Khác⭐️