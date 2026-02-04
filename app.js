// Keep Up - Nurture Your Relationships
// A warm, friendly way to stay connected with the people who matter

// Supabase configuration
const SUPABASE_URL = 'https://qcgqyleqyrcspbtiqxlh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZ3F5bGVxeXJjc3BidGlxeGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc2MzIsImV4cCI6MjA4NTEyMzYzMn0._C3HLm9MxabfwTqF6zMfw9pm5gyz2jFfYjCNM0dt-jE';

let supabase = null;

// Get or create a unique user ID for this browser
function getUserId() {
    let userId = localStorage.getItem('keepup_user_id');
    if (!userId) {
        userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('keepup_user_id', userId);
    }
    return userId;
}

const USER_ID = getUserId();

// Utility functions
const Utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    daysSince: (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.floor((today - date) / (1000 * 60 * 60 * 24));
    },

    daysUntil: (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.floor((date - today) / (1000 * 60 * 60 * 24));
    },

    getInitial: (name) => {
        return name.charAt(0).toUpperCase();
    },

    getTimeOfDay: () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    },

    // Gentle, non-judgmental time descriptions
    friendlyTimeSince: (days) => {
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 14) return 'Last week';
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 60) return 'Last month';
        return `${Math.floor(days / 30)} months ago`;
    }
};

// App state
let currentPersonForModal = null;
let currentCommitmentFilter = 'pending';
let peopleCache = [];
let commitmentsCache = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize tabs first so UI is responsive
    initTabs();
    initForms();
    initModal();
    initFilters();
    updateGreeting();

    // Initialize Supabase client
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        // Load data from Supabase
        await loadData();
    } else {
        console.warn('Supabase not loaded - running in offline mode');
    }
});

// Update greeting based on time of day
function updateGreeting() {
    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) {
        greetingEl.textContent = Utils.getTimeOfDay();
    }
}

// Load all data from Supabase
async function loadData() {
    await Promise.all([loadPeople(), loadCommitments()]);
    renderToday();
    renderPeople();
    renderCommitments();
    updatePersonDropdown();
    updateStats();
}

// Load people from Supabase
async function loadPeople() {
    if (!supabase) return;

    const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading people:', error);
        return;
    }
    peopleCache = data || [];
}

// Load commitments from Supabase
async function loadCommitments() {
    if (!supabase) return;

    const { data, error } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', USER_ID)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error loading commitments:', error);
        return;
    }
    commitmentsCache = data || [];
}

// Tab switching
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Form handling
function initForms() {
    // Add person form
    document.getElementById('add-person-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('person-name').value.trim();
        const frequency = parseInt(document.getElementById('person-frequency').value);
        const notes = document.getElementById('person-notes').value.trim();

        if (!name || !frequency) return;

        const { data, error } = await supabase
            .from('people')
            .insert({
                user_id: USER_ID,
                name,
                frequency,
                notes: notes || null,
                last_contact: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding person:', error);
            alert('Something went wrong. Please try again.');
            return;
        }

        peopleCache.unshift(data);
        e.target.reset();

        // Close the drawer after adding
        const drawer = document.querySelector('.add-person-drawer');
        if (drawer) drawer.removeAttribute('open');

        renderToday();
        renderPeople();
        updatePersonDropdown();
        updateStats();
    });

    // Add commitment form
    document.getElementById('add-commitment-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const personId = document.getElementById('commitment-person').value;
        const dueDate = document.getElementById('commitment-due').value;
        const text = document.getElementById('commitment-text').value.trim();

        if (!personId || !dueDate || !text) return;

        const { data, error } = await supabase
            .from('commitments')
            .insert({
                user_id: USER_ID,
                person_id: personId,
                text,
                due_date: dueDate,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding commitment:', error);
            alert('Something went wrong. Please try again.');
            return;
        }

        commitmentsCache.push(data);
        e.target.reset();
        renderCommitments();
        updateStats();
    });

    // Sort people
    document.getElementById('sort-people').addEventListener('change', renderPeople);
}

// Modal handling
function initModal() {
    const modal = document.getElementById('reach-out-modal');

    document.getElementById('cancel-reach-out').addEventListener('click', () => {
        modal.classList.remove('active');
        currentPersonForModal = null;
    });

    document.getElementById('confirm-reach-out').addEventListener('click', async () => {
        if (!currentPersonForModal) return;

        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabase
            .from('people')
            .update({ last_contact: today })
            .eq('id', currentPersonForModal);

        if (error) {
            console.error('Error updating contact:', error);
            alert('Something went wrong. Please try again.');
            return;
        }

        // Update cache
        const person = peopleCache.find(p => p.id === currentPersonForModal);
        if (person) {
            person.last_contact = today;
        }

        modal.classList.remove('active');
        currentPersonForModal = null;

        // Show celebration!
        showCelebration();

        renderToday();
        renderPeople();
    });

    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            currentPersonForModal = null;
        }
    });
}

// Celebration animation
function showCelebration() {
    const celebration = document.getElementById('celebration');
    celebration.classList.add('active');

    setTimeout(() => {
        celebration.classList.remove('active');
    }, 1500);
}

// Filter handling
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCommitmentFilter = btn.dataset.filter;
            renderCommitments();
        });
    });
}

// Update stats
function updateStats() {
    document.getElementById('stat-people').textContent = peopleCache.length;
    const pendingPromises = commitmentsCache.filter(c => !c.completed).length;
    document.getElementById('stat-promises').textContent = pendingPromises;
}

// Render Today dashboard - the heart of the app
function renderToday() {
    const container = document.getElementById('today-cards');

    // Find people who would love to hear from you
    const peopleWithStatus = peopleCache.map(person => {
        const daysSinceContact = Utils.daysSince(person.last_contact);
        const daysUntilDue = person.frequency - daysSinceContact;
        return { ...person, daysSinceContact, daysUntilDue };
    });

    // Show people who are due or almost due (within 3 days of their cycle)
    const needsAttention = peopleWithStatus
        .filter(p => p.daysUntilDue <= 3)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
        .slice(0, 5); // Show top 5

    if (needsAttention.length === 0) {
        container.innerHTML = '<p class="empty-state gentle">You\'re all caught up. Take a moment to appreciate your connections.</p>';
        return;
    }

    container.innerHTML = needsAttention.map(person => {
        const isReady = person.daysUntilDue <= 0;
        const nudgeClass = isReady ? 'nudge-ready' : 'nudge-gentle';
        const nudgeText = isReady ? 'Ready to connect' : 'Coming up soon';

        const frequencyText = person.frequency === 7 ? 'weekly' :
                             person.frequency === 14 ? 'every couple weeks' :
                             person.frequency === 30 ? 'monthly' : 'every few months';

        return `
            <div class="friend-card">
                <div class="friend-card-top">
                    <div class="friend-avatar">${Utils.getInitial(person.name)}</div>
                    <div class="friend-info">
                        <div class="friend-name">${escapeHtml(person.name)}</div>
                        <div class="friend-context">Last connected ${Utils.friendlyTimeSince(person.daysSinceContact)}</div>
                    </div>
                    <span class="friend-nudge ${nudgeClass}">${nudgeText}</span>
                </div>
                ${person.notes ? `<div class="friend-note">${escapeHtml(person.notes)}</div>` : ''}
                <div class="friend-actions">
                    <button class="action-btn action-primary" onclick="openReachOutModal('${person.id}', '${escapeHtml(person.name)}')">
                        We connected
                    </button>
                    <button class="action-btn action-secondary" onclick="addCommitmentFor('${person.id}')">
                        Add a promise
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render people roster
function renderPeople() {
    const peopleList = document.getElementById('people-list');
    const sortBy = document.getElementById('sort-people').value;

    document.getElementById('people-count').textContent = peopleCache.length;

    if (peopleCache.length === 0) {
        peopleList.innerHTML = '<p class="empty-state gentle">No one here yet. Add someone you\'d like to stay connected with.</p>';
        return;
    }

    // Calculate status for each person
    const peopleWithStatus = peopleCache.map(person => {
        const daysSinceContact = Utils.daysSince(person.last_contact);
        const daysUntilDue = person.frequency - daysSinceContact;
        return { ...person, daysSinceContact, daysUntilDue };
    });

    // Sort
    switch (sortBy) {
        case 'needs-love':
            peopleWithStatus.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
            break;
        case 'name':
            peopleWithStatus.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'recent':
            peopleWithStatus.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }

    peopleList.innerHTML = peopleWithStatus.map(person => {
        let statusClass, statusText;

        if (person.daysUntilDue <= 0) {
            statusClass = 'status-ready';
            statusText = 'Ready';
        } else if (person.daysUntilDue <= 7) {
            statusClass = 'status-soon';
            statusText = 'Soon';
        } else {
            statusClass = 'status-connected';
            statusText = 'Connected';
        }

        const frequencyText = person.frequency === 7 ? 'Weekly' :
                             person.frequency === 14 ? 'Bi-weekly' :
                             person.frequency === 30 ? 'Monthly' : 'Quarterly';

        return `
            <div class="roster-row" onclick="openReachOutModal('${person.id}', '${escapeHtml(person.name)}')">
                <div class="roster-avatar">${Utils.getInitial(person.name)}</div>
                <div class="roster-details">
                    <div class="roster-name">${escapeHtml(person.name)}</div>
                    <div class="roster-meta">${frequencyText} · ${Utils.friendlyTimeSince(person.daysSinceContact)}</div>
                </div>
                <span class="roster-status ${statusClass}">${statusText}</span>
                <div class="roster-actions-mini" onclick="event.stopPropagation()">
                    <button class="mini-btn delete" onclick="deletePerson('${person.id}')" title="Remove">
                        ×
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render commitments list
function renderCommitments() {
    const commitmentsList = document.getElementById('commitments-list');
    let commitments = [...commitmentsCache];

    // Filter
    if (currentCommitmentFilter === 'pending') {
        commitments = commitments.filter(c => !c.completed);
    } else if (currentCommitmentFilter === 'completed') {
        commitments = commitments.filter(c => c.completed);
    }

    // Update count (always show pending count)
    const pendingCount = commitmentsCache.filter(c => !c.completed).length;
    document.getElementById('commitments-count').textContent = pendingCount;

    if (commitments.length === 0) {
        const message = currentCommitmentFilter === 'pending'
            ? 'No open promises. You\'re doing great!'
            : currentCommitmentFilter === 'completed'
            ? 'No promises kept yet. That\'s okay.'
            : 'No promises tracked yet. That\'s okay.';
        commitmentsList.innerHTML = `<p class="empty-state gentle">${message}</p>`;
        return;
    }

    // Sort by due date
    commitments.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    commitmentsList.innerHTML = commitments.map(commitment => {
        const person = peopleCache.find(p => p.id === commitment.person_id);
        const personName = person ? person.name : 'Someone';
        const daysUntil = Utils.daysUntil(commitment.due_date);

        let dueClass = '';
        let dueText = Utils.formatDate(commitment.due_date);

        if (!commitment.completed) {
            if (daysUntil < 0) {
                dueClass = 'overdue';
                dueText = `${Math.abs(daysUntil)} days ago`;
            } else if (daysUntil === 0) {
                dueClass = 'soon';
                dueText = 'Today';
            } else if (daysUntil <= 3) {
                dueClass = 'soon';
                dueText = `In ${daysUntil} days`;
            }
        }

        return `
            <div class="commitment-card ${commitment.completed ? 'completed' : ''}">
                <div class="commitment-card-header">
                    <span class="commitment-text">${escapeHtml(commitment.text)}</span>
                    ${commitment.completed ? '<span class="completed-badge">Kept</span>' : ''}
                </div>
                <div class="commitment-person">To ${escapeHtml(personName)}</div>
                <div class="commitment-due ${dueClass}">${dueText}</div>
                <div class="commitment-actions">
                    ${!commitment.completed ? `
                        <button class="btn btn-warm btn-small" onclick="completeCommitment('${commitment.id}')">
                            I kept this promise
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-small" onclick="uncompleteCommitment('${commitment.id}')">
                            Reopen
                        </button>
                    `}
                    <button class="btn-delete" onclick="deleteCommitment('${commitment.id}')" title="Remove">
                        ×
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Update person dropdown in commitment form
function updatePersonDropdown() {
    const select = document.getElementById('commitment-person');

    select.innerHTML = '<option value="">Who did you promise?</option>' +
        peopleCache.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

// Action functions
function openReachOutModal(personId, personName) {
    currentPersonForModal = personId;
    document.getElementById('modal-person-name').textContent = `Catching up with ${personName}`;
    document.getElementById('reach-out-notes').value = '';
    document.getElementById('reach-out-modal').classList.add('active');
}

function addCommitmentFor(personId) {
    document.querySelector('[data-tab="commitments"]').click();
    document.getElementById('commitment-person').value = personId;
    document.getElementById('commitment-text').focus();
}

async function deletePerson(personId) {
    if (!confirm('Remove this person from your list?')) return;

    const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', personId);

    if (error) {
        console.error('Error deleting person:', error);
        alert('Something went wrong. Please try again.');
        return;
    }

    peopleCache = peopleCache.filter(p => p.id !== personId);
    commitmentsCache = commitmentsCache.filter(c => c.person_id !== personId);
    renderToday();
    renderPeople();
    renderCommitments();
    updatePersonDropdown();
    updateStats();
}

async function completeCommitment(commitmentId) {
    const { error } = await supabase
        .from('commitments')
        .update({
            completed: true,
            completed_at: new Date().toISOString()
        })
        .eq('id', commitmentId);

    if (error) {
        console.error('Error completing commitment:', error);
        alert('Something went wrong. Please try again.');
        return;
    }

    const commitment = commitmentsCache.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = true;
        commitment.completed_at = new Date().toISOString();
    }

    // Mini celebration for keeping a promise
    showCelebration();

    renderCommitments();
    updateStats();
}

async function uncompleteCommitment(commitmentId) {
    const { error } = await supabase
        .from('commitments')
        .update({
            completed: false,
            completed_at: null
        })
        .eq('id', commitmentId);

    if (error) {
        console.error('Error updating commitment:', error);
        alert('Something went wrong. Please try again.');
        return;
    }

    const commitment = commitmentsCache.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = false;
        commitment.completed_at = null;
    }
    renderCommitments();
    updateStats();
}

async function deleteCommitment(commitmentId) {
    if (!confirm('Remove this promise?')) return;

    const { error } = await supabase
        .from('commitments')
        .delete()
        .eq('id', commitmentId);

    if (error) {
        console.error('Error deleting commitment:', error);
        alert('Something went wrong. Please try again.');
        return;
    }

    commitmentsCache = commitmentsCache.filter(c => c.id !== commitmentId);
    renderCommitments();
    updateStats();
}

// Utility to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
