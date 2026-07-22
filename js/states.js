let currentUser=null;
let allCards=[];
let userPlan='free';
let isAdmin=false;
let currentDeckId=null;
let currentTopic=null;
let studyQueue=[];
let studyIdx=0;
let fcFlipped=false;
let bootstrapped = false;
let initDone = false;
let appEntered = false;
let authReady = false;
let dataReady = false;
let dataHealthy = true;
let isLoadingData = false;
let syncTimeout = null;
let currentSyncPromise = null;
let saveTimeout = null;
let lastSavedTimestamp = 0;

let tsCorrect=0,
tsIncorrect=0,
tsCurrentAnswer='';

let selectedPlan='regular';
let selectedDuration=3;

let deckOrderConfig = {
  topics: [],
  subtopics: {}
};

let hasValidCode=false;
let currentTab='home';
let navTimeout=null;
let progressPeriod='week';
let isSyncing=false;
let renameDeckId=null;
let manageDeckId=null;
let editCardId=null;
let addingToDeckId=null;
let previousView='decks';
let resetCode='';
let resetEmail='';
let selectedCardIds=[];
let selectedDeckIds=[];
let dbPromise = null;

let sessionStats={
again:0,
hard:0,
good:0,
easy:0
};
