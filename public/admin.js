const SUPABASE_URL = 'https://prjnvbewxfegpbyavcrv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByam52YmV3eGZlZ3BieWF2Y3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTM5NjQsImV4cCI6MjA4MjQyOTk2NH0.LzR1Lf8VWVRH6yDYWtE30UKZul6tCModIQyrUz1rXNE'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

const configForm = document.getElementById('config-form');
const weekLabelInput = document.getElementById('week-label');
const validCodeInput = document.getElementById('valid-code');
const submissionsOpenInput = document.getElementById('submissions-open');
const activeFromInput = document.getElementById('active-from');
const expiresAtInput = document.getElementById('expires-at');
const statusIndicator = document.getElementById('status-indicator');

const quickCloseBtn = document.getElementById('quick-close-btn');
const closeAllBtn = document.getElementById('close-all-btn');

const submissionsBody = document.getElementById('submissions-body');
const refreshBtn = document.getElementById('refresh-btn');
const winnerDisplay = document.getElementById('winner-display');

// State
let currentConfig = null;

// --- Authentication ---

supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showDashboard();
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Login failed: ' + error.message);
    } else {
        showDashboard();
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
});

// --- Dashboard Logic ---

async function showDashboard() {
    loginSection.classList.add('hidden');
    loginSection.style.display = 'none';
    
    dashboardSection.classList.remove('hidden');
    dashboardSection.style.display = 'block';

    await loadWeekData();
}

async function loadWeekData() {
    await loadCurrentConfig();
    await loadSubmissions(); // Will use currentConfig to filter
}

refreshBtn.addEventListener('click', loadSubmissions);

// --- Weekly Config ---

async function loadCurrentConfig() {
    const { data, error } = await supabaseClient
        .from('weekly_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error loading config:', error);
        return;
    }

    if (data) {
        currentConfig = data;
        // Populate form
        // Handle week_label safely (it might not exist in older rows or schema)
        weekLabelInput.value = data.week_label || ''; 
        validCodeInput.value = data.valid_code || '';
        submissionsOpenInput.checked = data.is_active;

        if (data.active_from) {
            activeFromInput.value = new Date(data.active_from).toISOString().slice(0, 16);
        } else {
            activeFromInput.value = '';
        }

        if (data.expires_at) {
            expiresAtInput.value = new Date(data.expires_at).toISOString().slice(0, 16);
        } else {
            expiresAtInput.value = '';
        }

        updateStatusIndicator();
    } else {
        // No config yet
        weekLabelInput.value = '';
        validCodeInput.value = '';
        submissionsOpenInput.checked = false;
        activeFromInput.value = '';
        expiresAtInput.value = '';
        statusIndicator.textContent = 'No config';
    }
}

function updateStatusIndicator() {
    if (!currentConfig) return;
    
    // Status Logic:
    // Scheduled: Current time < active_from
    // Active: active_from <= Current time <= expires_at (AND is_active = true)
    // Expired: Current time > expires_at
    // Closed Manually: is_active = false

    const now = new Date();
    const start = currentConfig.active_from ? new Date(currentConfig.active_from) : null;
    const end = currentConfig.expires_at ? new Date(currentConfig.expires_at) : null;
    const manuallyOpen = currentConfig.is_active;

    let statusText = '';
    let statusColor = '#555';

    if (!manuallyOpen) {
        statusText = 'Closed Manually (Submissions OFF)';
        statusColor = 'red';
    } else if (start && now < start) {
        statusText = `Scheduled (Opens ${start.toLocaleString()})`;
        statusColor = 'orange';
    } else if (end && now > end) {
        statusText = `Expired (Closed on ${end.toLocaleString()})`;
        statusColor = 'gray';
    } else if (start && end) {
        statusText = 'Active (Submissions Open)';
        statusColor = 'green';
    } else {
        // Fallback if dates are missing but is_active is true
        statusText = 'Active (No dates set)';
        statusColor = 'green';
    }

    statusIndicator.textContent = statusText;
    statusIndicator.style.color = statusColor;
}

configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newLabel = weekLabelInput.value;
    const newCode = validCodeInput.value;
    const isActive = submissionsOpenInput.checked;
    const activeFrom = activeFromInput.value ? new Date(activeFromInput.value).toISOString() : null;
    const expiresAt = expiresAtInput.value ? new Date(expiresAtInput.value).toISOString() : null;

    if (!newCode) return;

    // REVISED LOGIC:
    // 1. If we just toggle `is_active`, UPDATE the current row.
    // 2. If we change `valid_code` or `week_label`, we ASK or assume.
    // Let's stick to UPDATE for now to avoid losing history unintentionally.
    // "Resetting submissions" might just be a side effect of changing the code (old subs won't match new code).
    
    const updates = {
        valid_code: newCode,
        is_active: isActive,
        active_from: activeFrom,
        expires_at: expiresAt
        // Don't update created_at, so we keep the same "Week" window
    };

    // Only add week_label if it's not empty, to avoid errors if column missing
    if (newLabel) {
        updates.week_label = newLabel;
    }

    let error = null;

    if (currentConfig && currentConfig.id) {
        // Update existing
        const { error: err } = await supabaseClient
            .from('weekly_config')
            .update(updates)
            .eq('id', currentConfig.id);
        error = err;
    } else {
        // Insert new
        const { error: err } = await supabaseClient
            .from('weekly_config')
            .insert([updates]);
        error = err;
    }

    if (error) {
        console.error('Config update error:', error);
        
        // Fallback: Try again without week_label (in case DB schema is old)
        const originalError = error.message;
        
        // Only retry if we haven't already tried (prevent infinite loop if we were already generic)
        // But here we just try once more without week_label
        
        delete updates.week_label;
        let retryError = null;
        
        if (currentConfig && currentConfig.id) {
            const { error: err2 } = await supabaseClient.from('weekly_config').update(updates).eq('id', currentConfig.id);
            retryError = err2;
        } else {
            const { error: err2 } = await supabaseClient.from('weekly_config').insert([updates]);
            retryError = err2;
        }
        
        if (retryError) {
             alert('Error saving config: ' + originalError + '\nRetry error: ' + retryError.message);
        } else {
             alert('Configuration saved (Week Label excluded due to database schema mismatch).');
             loadCurrentConfig();
        }
        return;
    }

    alert('Configuration saved successfully.');
    loadCurrentConfig();
});

// Helper for closing
async function setSubmissionStatus(isOpen) {
    if (!currentConfig) return;
    
    const { error } = await supabaseClient
        .from('weekly_config')
        .update({ is_active: isOpen })
        .eq('id', currentConfig.id);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        submissionsOpenInput.checked = isOpen;
        currentConfig.is_active = isOpen;
        // alert(isOpen ? 'Submissions Opened' : 'Submissions Closed');
    }
}

quickCloseBtn.addEventListener('click', () => setSubmissionStatus(false));
closeAllBtn.addEventListener('click', () => {
    if(confirm('Are you sure you want to CLOSE ALL submissions immediately?')) {
        setSubmissionStatus(false);
    }
});


// --- Submissions Table & Winner ---

async function loadSubmissions() {
    submissionsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    winnerDisplay.innerHTML = '<p class="helper-text">Loading...</p>';

    if (!currentConfig) {
        submissionsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No active week configuration.</td></tr>';
        winnerDisplay.innerHTML = '<p class="helper-text">No active week.</p>';
        return;
    }

    // Fetch submissions since the start of this config
    // Logic: Submissions belong to the week started at `currentConfig.created_at`
    // However, the edge function compares with `gte` created_at too.
    // Let's debug by fetching ALL submissions first to see if they exist.
    // If we have a time zone issue, the created_at of submission might be slightly BEFORE config?
    // Actually, config is created first.
    
    // Let's try to broaden the search slightly to catch edge cases where clocks might be slightly off (though server time should match)
    // Or just fetch ALL for now to debug, then filter in memory?
    // No, better to trust the ID logic if we had a foreign key, but we don't.
    
    const { data: submissions, error } = await supabaseClient
        .from('submissions')
        .select('*')
        // .gte('created_at', currentConfig.created_at) // Relaxing this constraint for now to debug visibility
        .order('created_at', { ascending: true }); 

    if (error) {
        console.error('Error loading submissions:', error);
        submissionsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data</td></tr>';
        return;
    }

    renderTable(submissions);
    determineWinner(submissions);
}

function renderTable(submissions) {
    if (!submissions || submissions.length === 0) {
        submissionsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No submissions yet.</td></tr>';
        return;
    }

    submissionsBody.innerHTML = '';
    
    // Submissions are already sorted by time ASC (oldest first)
    submissions.forEach(sub => {
        const date = new Date(sub.created_at);
        const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const isWinner = sub.is_correct && !window.winnerFound; 
        if (isWinner) window.winnerFound = true; // Simple logic: first correct is winner

        const tr = document.createElement('tr');
        if (isWinner) tr.classList.add('winner-row');

        tr.innerHTML = `
            <td>${timeStr}</td>
            <td>${escapeHtml(sub.first_name)}</td>
            <td>${escapeHtml(sub.phone_number)}</td>
            <td><code style="background: #eee; padding: 2px 4px; border-radius: 3px;">${escapeHtml(sub.submitted_code)}</code></td>
            <td>
                ${sub.is_correct 
                    ? `<span class="badge badge-correct">Correct</span>${isWinner ? ' <span class="badge badge-winner">WINNER</span>' : ''}` 
                    : '<span class="badge badge-wrong">Incorrect</span>'}
            </td>
        `;
        submissionsBody.appendChild(tr);
    });
    
    // Reset for next render
    window.winnerFound = false;
}

function determineWinner(submissions) {
    // Find first correct submission
    const winner = submissions.find(s => s.is_correct);

    if (winner) {
        winnerDisplay.innerHTML = `
            <div class="winner-card">
                <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 5px;">
                    🎉 ${escapeHtml(winner.first_name)}
                </div>
                <div style="font-family: monospace; font-size: 1.1rem; margin-bottom: 5px;">
                    ${escapeHtml(winner.phone_number)}
                </div>
                <div style="font-size: 0.9rem; color: #555;">
                    Submitted: ${new Date(winner.created_at).toLocaleString()}
                </div>
                <button class="copy-btn" onclick="copyToClipboard('${winner.phone_number}')">
                    Copy Phone
                </button>
                <a href="https://wa.me/${formatPhoneForWhatsapp(winner.phone_number)}" target="_blank" class="copy-btn" style="text-decoration: none; margin-left: 5px;">
                    WhatsApp
                </a>
            </div>
        `;
    } else {
        winnerDisplay.innerHTML = '<p class="helper-text">No correct entries yet.</p>';
    }
}

// --- Utilities ---

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPhoneForWhatsapp(phone) {
    // Basic cleanup, assuming Nigerian numbers often provided as 080... -> 23480...
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) {
        p = '234' + p.substring(1);
    }
    return p;
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied: ' + text);
    });
};
