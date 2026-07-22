const DEFAULT_PROGRESS = {
    ease_factor: 2.5,
    interval: 0,
    repetitions: 0,
    total_reviews: 0,
    correct_count: 0,
    next_review: '',
    last_review: '',
    review_history: []
};

function getMigrationFlag(email) {
    return localStorage.getItem('Pharmadeck_migration_' + MIGRATION_VERSION + '_' + email) === 'true';
}

function setMigrationFlag(email) {
    localStorage.setItem('Pharmadeck_migration_' + MIGRATION_VERSION + '_' + email, 'true');
}
