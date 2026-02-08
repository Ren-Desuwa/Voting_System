// js/auth.js
// Client-side authentication management

// Check authentication status on page load
async function checkAuthentication() {
    const token = localStorage.getItem('election_session_token');
    
    if(!token) {
        showPinScreen();
        return false;
    }
    
    // Validate token with server
    try {
        const res = await fetch('api/session_check.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: token })
        });
        
        const result = await res.json();
        
        if(result.valid) {
            hidePinScreen();
            return true;
        } else {
            // Token expired or invalid
            localStorage.removeItem('election_session_token');
            showPinScreen();
            return false;
        }
    } catch(e) {
        console.error('Auth check failed:', e);
        showPinScreen();
        return false;
    }
}

// Show PIN entry screen
function showPinScreen() {
    document.getElementById('pinAuthScreen').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
}

// Hide PIN entry screen
function hidePinScreen() {
    document.getElementById('pinAuthScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// Handle PIN submission
async function submitPin() {
    const pinInput = document.getElementById('pinInput');
    const pin = pinInput.value.trim();
    const errorMsg = document.getElementById('pinError');
    const submitBtn = document.getElementById('pinSubmitBtn');
    
    if(!pin) {
        errorMsg.textContent = 'Please enter the PIN';
        errorMsg.style.display = 'block';
        return;
    }
    
    // Disable button during request
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    errorMsg.style.display = 'none';
    
    try {
        const res = await fetch('api/auth_pin.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ pin: pin })
        });
        
        const result = await res.json();
        
        if(result.success) {
            // Store token in localStorage
            localStorage.setItem('election_session_token', result.token);
            
            // Clear PIN input
            pinInput.value = '';
            
            // Show success message
            errorMsg.style.display = 'block';
            errorMsg.style.color = '#28a745';
            errorMsg.textContent = '✓ Access granted! Loading...';
            
            // Hide PIN screen after short delay
            setTimeout(() => {
                hidePinScreen();
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
                errorMsg.style.display = 'none';
                errorMsg.style.color = '#e74c3c';
            }, 800);
            
        } else {
            // Show error
            errorMsg.textContent = result.message || 'Incorrect PIN';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            pinInput.value = '';
            pinInput.focus();
        }
        
    } catch(e) {
        console.error('PIN submission failed:', e);
        errorMsg.textContent = 'Network error. Please try again.';
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

// Allow Enter key to submit PIN
function handlePinKeyPress(event) {
    if(event.key === 'Enter') {
        submitPin();
    }
}

// Initialize authentication check when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});