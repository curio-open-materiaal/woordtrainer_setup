/*! Lity - v2.2.2 - 2017-07-17
* http://sorgalla.com/lity/
* Copyright (c) 2015-2017 Jan Sorgalla; Licensed MIT */
let currentAudio = null;

// Lightweight local progress tracking across exercises
if (!window.wtProgress) {
    // Include search params too so different project instances don't collide
    const keyBasePath = (location && location.pathname) ? location.pathname : 'wt';
    const keyBaseQuery = (location && location.search) ? location.search : '';
    const storageKey = `wt:done:${keyBasePath}${keyBaseQuery}`;

    function readStore() {
        try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) { return {}; }
    }
    function writeStore(obj) {
        try { localStorage.setItem(storageKey, JSON.stringify(obj)); } catch(e) {}
    }
    // Separate store for stats
    const statsKey = `wt:stats:${keyBasePath}${keyBaseQuery}`;
    function readStats() {
        try { return JSON.parse(localStorage.getItem(statsKey) || '{}'); } catch(e) { return {}; }
    }
    function writeStats(obj) {
        try { localStorage.setItem(statsKey, JSON.stringify(obj)); } catch(e) {}
        try { window.dispatchEvent(new CustomEvent('wt:statsUpdated', { detail: { key: statsKey } })); } catch(e) {}
    }

    function normalizeId(exerciseId) {
        // Make id unique per page when available
        try {
            if (typeof window.x_currentPage !== 'undefined' && window.x_currentPage !== null) {
                // Use 1-based page index for stored key to match UI numbering
                return `${exerciseId}@p${(window.x_currentPage + 1)}`;
            }
        } catch(e) {}
        return exerciseId;
    }

    window.wtProgress = {
        markDone: function(exerciseId) {
            if (!exerciseId) return;
            const data = readStore();
            const key = normalizeId(exerciseId);
            data[key] = Date.now();
            writeStore(data);
            // Trigger event so xenith.js can enable the "verder" button
            try {
                window.dispatchEvent(new CustomEvent('wt:exerciseDone', { detail: { exerciseId: exerciseId, key: key } }));
            } catch(e) {}
        },
        isDone: function(exerciseId) {
            const data = readStore();
            const key = normalizeId(exerciseId);
            return !!data[key];
        },
        all: function() { return readStore(); },
        saveStats: function(exerciseId, payload) {
            if (!exerciseId) return;
            const key = normalizeId(exerciseId);
            const stats = readStats();
            stats[key] = {
                ...(stats[key] || {}),
                ...payload,
                updatedAt: Date.now()
            };
            writeStats(stats);
        },
        getStats: function(exerciseId) {
            const key = normalizeId(exerciseId);
            const stats = readStats();
            return stats[key];
        },
        allStats: function() { return readStats(); }
    };

    window.wtMarkExerciseDone = function(exerciseId) { window.wtProgress.markDone(exerciseId); };
    window.wtIsExerciseDone = function(exerciseId) { return window.wtProgress.isDone(exerciseId); };
    window.wtSaveStats = function(exerciseId, payload) { window.wtProgress.saveStats(exerciseId, payload); };
    window.wtGetStats = function(exerciseId) { return window.wtProgress.getStats(exerciseId); };

    // Global word stats (not per course) - stores scores per word across all courses
    const globalWordStatsKey = 'wt:globalWordStats';
    function readGlobalWordStats() {
        try { return JSON.parse(localStorage.getItem(globalWordStatsKey) || '{}'); } catch(e) { return {}; }
    }
    function writeGlobalWordStats(obj) {
        try { localStorage.setItem(globalWordStatsKey, JSON.stringify(obj)); } catch(e) {}
    }
    
    window.wtGetGlobalWordStats = function(word) {
        if (!word) return null;
        const wordKey = String(word).trim().toLowerCase();
        const stats = readGlobalWordStats();
        return stats[wordKey] || null;
    };
    
    window.wtSaveGlobalWordStats = function(word, isCorrect) {
        if (!word) return;
        try {
            const wordKey = String(word).trim().toLowerCase();
            const stats = readGlobalWordStats();
            if (!stats[wordKey]) {
                stats[wordKey] = { right: 0, wrong: 0, total: 0 };
            }
            if (isCorrect) {
                stats[wordKey].right++;
            } else {
                stats[wordKey].wrong++;
            }
            stats[wordKey].total = stats[wordKey].right + stats[wordKey].wrong;
            stats[wordKey].lastPracticed = Date.now();
            writeGlobalWordStats(stats);
        } catch(e) {}
    };

    // Unified API for recording attempts from any exercise
    // Signature: wtRecordAttempt(exerciseId, word, isCorrect, chosenOptional)
    // Memory and flashcards do not record progress (geen progress bij memory en flashcards)
    window.wtRecordAttempt = function(exerciseId, word, isCorrect, chosen) {
        try {
            const id = (exerciseId || '').toLowerCase();
            if (id === 'woordmemory' || id === 'memory' || id === 'newflashcard' || id === 'flashcardsplus' || id === 'flashcards') return;
            const prev = window.wtGetStats ? (window.wtGetStats(exerciseId) || {}) : {};
            const rightCount = (prev.rightCount || 0) + (isCorrect ? 1 : 0);
            const wrongCount = (prev.wrongCount || 0) + (isCorrect ? 0 : 1);
            const wrong = Array.isArray(prev.wrong) ? prev.wrong.slice() : [];
            if (!isCorrect) {
                wrong.push({ chosen: chosen || null, correct: word });
            }
            const total = rightCount + wrongCount;
            const accuracy = total > 0 ? +(rightCount / total * 100).toFixed(1) : 0;
            if (window.wtSaveStats) {
                window.wtSaveStats(exerciseId, {
                    word: (word || '').toString(),
                    rightCount,
                    wrongCount,
                    wrong,
                    total,
                    accuracy
                });
            }
            // Also save to global word stats (not per course)
            if (window.wtSaveGlobalWordStats) {
                window.wtSaveGlobalWordStats(word, isCorrect);
            }
            if (isCorrect && window.wtMarkExerciseDone) {
                window.wtMarkExerciseDone(exerciseId);
            }
            // Record for current-level-only stats (cleared when starting a new level)
            try {
                if (word && typeof word === 'string') {
                    var cKey = 'wt:currentLevelStats:' + (location.pathname || '') + (location.search || '');
                    var cData = {};
                    try { cData = JSON.parse(localStorage.getItem(cKey) || '{}'); } catch (e2) {}
                    var wk = word.trim().toLowerCase();
                    if (wk) {
                        if (!cData[wk]) cData[wk] = { word: word.trim(), right: 0, wrong: 0 };
                        if (isCorrect) cData[wk].right += 1; else cData[wk].wrong += 1;
                        localStorage.setItem(cKey, JSON.stringify(cData));
                    }
                }
            } catch (e2) {}
        } catch(e) {}
    };

    // Get custom word set from localStorage (if available)
    window.wtGetCustomWordSet = function() {
        try {
            const saved = localStorage.getItem('wt:customWordSet');
            if (saved) {
                const words = JSON.parse(saved);
                if (Array.isArray(words) && words.length > 0) {
                    return words;
                }
            }
        } catch(e) {}
        return null;
    };

    // Helper function to get words for exercises - checks custom set first, then falls back to project words
    // Returns array of word objects with: { word, betekenis, contextzinExpliciet, contextzinImpliciet, ... }
    window.wtGetWordsForExercise = function() {
        // First check for custom word set
        const customSet = window.wtGetCustomWordSet();
        if (customSet && customSet.length > 0) {
            return customSet;
        }
        
        // Otherwise return null - exercises will use their own getWordsFromProject logic
        return null;
    };

    // Component function to create score section for word modals
    // Parameters:
    //   - wordData: Object with word property
    //   - buildPracticeSummary: Function that returns practice summary object
    //   - showTranslations: Optional function to show translations (for empty state message)
    // Returns: DOM element with score section
    window.wtCreateScoreSection = function(wordData, buildPracticeSummary, showTranslations) {
        const practiceSummary = buildPracticeSummary();
        const wordKey = wordData.word.trim().toLowerCase();
        const stats = practiceSummary[wordKey];
        
        const scoreSection = document.createElement('div');
        scoreSection.className = 'score-section';
        
        const scoreTitle = document.createElement('div');
        scoreTitle.className = 'score-section-title';
        scoreTitle.textContent = 'Voortgang';
        scoreSection.appendChild(scoreTitle);
        
        if (stats && (stats.right > 0 || stats.wrong > 0)) {
            const scoreStats = document.createElement('div');
            scoreStats.className = 'score-stats';
            
            const totalStat = document.createElement('div');
            totalStat.className = 'score-stat';
            totalStat.innerHTML = `
                <div class="score-stat-label">Totaal</div>
                <div class="score-stat-value">${stats.right + stats.wrong}</div>
            `;
            scoreStats.appendChild(totalStat);
            
            const rightStat = document.createElement('div');
            rightStat.className = 'score-stat';
            rightStat.innerHTML = `
                <div class="score-stat-label">Goed</div>
                <div class="score-stat-value" style="color: #28a745;">${stats.right}</div>
            `;
            scoreStats.appendChild(rightStat);
            
            const wrongStat = document.createElement('div');
            wrongStat.className = 'score-stat';
            wrongStat.innerHTML = `
                <div class="score-stat-label">Fout</div>
                <div class="score-stat-value" style="color: #dc3545;">${stats.wrong}</div>
            `;
            scoreStats.appendChild(wrongStat);
            
            scoreSection.appendChild(scoreStats);
        } else {
            const scoreMessage = document.createElement('div');
            scoreMessage.style.cssText = 'color: #666; font-size: 0.9rem; text-align: center; padding: 0.5rem 0;';
            const messageText = 'Doe opdrachten met dit woord om voortgang te zien.';
            scoreMessage.textContent = messageText;
            scoreSection.appendChild(scoreMessage);
            
            // Add translation to score message if function is provided
            if (typeof showTranslations === 'function') {
                showTranslations(messageText, scoreSection);
            }
        }
        
        return scoreSection;
    };

    // Global background wordcloud overlay (uses stored stats words)
    function collectAllPracticedWords() {
        const words = new Set();
        try {
            const prefix = `wt:stats:${location.pathname}`;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(prefix)) continue;
                let stats = {};
                try { stats = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { stats = {}; }
                Object.values(stats).forEach(v => {
                    if (v && v.word) {
                        const w = String(v.word).trim();
                        if (w) words.add(w);
                    }
                });
            }
        } catch(e) {}
        return Array.from(words);
    }

    function ensureWordcloudHost() { return null; }

    function renderWordcloud() {
        try {
            const host = document.getElementById('wtWordcloudOverlay');
            if (host) host.remove();
        } catch(e) {}
        return;
    }

    // Initial render and live updates
    window.addEventListener('load', renderWordcloud, { passive: true });
    window.addEventListener('resize', renderWordcloud, { passive: true });
    window.addEventListener('wt:statsUpdated', renderWordcloud, { passive: true });
}

// TTS config and helpers to improve Dutch pronunciation
const WT_TTS = {
    useDutchContextHint: false,
    fallbackShortWordsToWebTTS: true,
    fallbackMaxChars: 6
};

// Common tricky words → Dutch hint
const pronunciationOverrides = {
    // Override entries can be added here if needed, but avoid adding spoken hints
};

function applyPronunciationOverrides(text) {
    try {
        const tokens = text.split(/(\s+)/); // keep spaces
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (/^\s+$/.test(t)) continue;
            const key = t.toLowerCase();
            if (pronunciationOverrides[key]) {
                tokens[i] = pronunciationOverrides[key];
            }
        }
        return tokens.join("");
    } catch (e) {
        return text;
    }
}

// speakWithWebDutch removed - only using ElevenLabs now

function getWoordtrainerTtsProxyUrl() {
    if (typeof window.wtTtsProxyUrl === 'string' && window.wtTtsProxyUrl) {
        return window.wtTtsProxyUrl;
    }
    return getWoordtrainerSetupBaseUrl() + '/api/elevenlabs_tts.php';
}

function getWoordtrainerSetupBaseUrl() {
    if (typeof window.wtSetupBaseUrl === 'string' && window.wtSetupBaseUrl) {
        return window.wtSetupBaseUrl;
    }
    var path = window.location.pathname || '';
    var idx = path.indexOf('/modules/');
    if (idx < 0) {
        idx = path.indexOf('/website_code/');
    }
    var root = idx > 0 ? path.substring(0, idx) : '';
    return root + '/woordtrainer_setup';
}

function getWoordtrainerPublicSettingsUrl() {
    return getWoordtrainerSetupBaseUrl() + '/api/public_settings.php';
}

var wtPublicSettingsPromise = null;
function loadWoordtrainerPublicSettings() {
    if (!wtPublicSettingsPromise) {
        wtPublicSettingsPromise = fetch(getWoordtrainerPublicSettingsUrl(), { credentials: 'same-origin' })
            .then(function (response) { return response.ok ? response.json() : {}; })
            .catch(function () { return {}; });
    }
    return wtPublicSettingsPromise;
}

// removed progress approximation fallback

function speakWithElevenLabs(text) {
    // Stop any currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Show loading spinner
    showTTSLoadingSpinner();

    // Apply overrides and optional Dutch context hint
    let requestText = applyPronunciationOverrides(text);

    fetch(getWoordtrainerTtsProxyUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            text: requestText
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().catch(function () {
                return { error: 'TTS error: ' + response.status };
            }).then(function (data) {
                throw new Error(data.error || ('TTS error: ' + response.status));
            });
        }
        return response.blob();
    })
    .then(blob => {
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        
        currentAudio.addEventListener('play', () => { hideTTSLoadingSpinner(); });
        currentAudio.addEventListener('error', () => { hideTTSLoadingSpinner(); });
        setTimeout(() => { hideTTSLoadingSpinner(); }, 10000);
        currentAudio.play();
    })
    .catch(error => {
        console.error("TTS error:", error);
        hideTTSLoadingSpinner();
    });
}

function playText(text) {
    if (!text || text.trim() === "") {
        console.warn("No text provided for TTS.");
        return;
    }
    speakWithElevenLabs(text);
}

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

// TTS Loading Spinner Functions
function showTTSLoadingSpinner() {
    // Remove any existing spinner
    hideTTSLoadingSpinner();
    
    // Create spinner element
    const spinner = document.createElement('div');
    spinner.id = 'tts-loading-spinner';
    spinner.innerHTML = `
        <div class="tts-spinner-content">
            <div class="tts-spinner"></div>
            <div class="tts-spinner-text">Geluid laden</div>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(spinner);
    
    // Add CSS if not already added
    if (!document.getElementById('tts-spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'tts-spinner-styles';
        style.textContent = `
            #tts-loading-spinner {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                font-family: Arial, sans-serif;
            }
            
            .tts-spinner-content {
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tts-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: tts-spin 1s linear infinite;
            }
            
            .tts-spinner-text {
                color: white;
                font-size: 12px;
                font-weight: 500;
            }
            
            @keyframes tts-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideTTSLoadingSpinner() {
    const spinner = document.getElementById('tts-loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

(function (window, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], function ($) {
            return factory(window, $);
        });
    } else if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory(window, require('jquery'));
    } else {
        window.lity = factory(window, window.jQuery || window.Zepto);
    }
}(typeof window !== "undefined" ? window : this, function (window, $) {
    'use strict';

    var document = window.document;

    var _win = $(window);
    var _deferred = $.Deferred;
    var _html = $('html');
    var _instances = [];

    var _attrAriaHidden = 'aria-hidden';
    var _dataAriaHidden = 'lity-' + _attrAriaHidden;

    var _focusableElementsSelector = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[contenteditable],[tabindex]:not([tabindex^="-"])';

    var _defaultOptions = {
        esc: true,
        handler: null,
        handlers: {
            image: imageHandler,
            inline: inlineHandler,
            youtube: youtubeHandler,
            vimeo: vimeoHandler,
            googlemaps: googlemapsHandler,
            facebookvideo: facebookvideoHandler,
            iframe: iframeHandler
        },
        template: '<div class="lity" role="dialog" aria-label="Dialog Window (Press escape to close)" tabindex="-1"><div class="lity-wrap" data-lity-close role="document"><div class="lity-loader" aria-hidden="true">Loading...</div><div class="lity-container"><div class="lity-content"></div><button class="lity-close" type="button" aria-label="Close (Press escape to close)" data-lity-close>×</button></div></div></div>'
    };

    var _imageRegexp = /(^data:image\/)|(\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?)(\?\S*)?$)/i;
    var _youtubeRegex = /(youtube(-nocookie)?\.com|youtu\.be)\/(watch\?v=|v\/|u\/|embed\/?)?([\w-]{11})(.*)?/i;
    var _vimeoRegex = /(vimeo(pro)?.com)\/(?:[^\d]+)?(\d+)\??(.*)?$/;
    var _googlemapsRegex = /((maps|www)\.)?google\.([^\/\?]+)\/?((maps\/?)?\?)(.*)/i;
    var _facebookvideoRegex = /(facebook\.com)\/([a-z0-9_-]*)\/videos\/([0-9]*)(.*)?$/i;

    var _transitionEndEvent = (function () {
        var el = document.createElement('div');

        var transEndEventNames = {
            WebkitTransition: 'webkitTransitionEnd',
            MozTransition: 'transitionend',
            OTransition: 'oTransitionEnd otransitionend',
            transition: 'transitionend'
        };

        for (var name in transEndEventNames) {
            if (el.style[name] !== undefined) {
                return transEndEventNames[name];
            }
        }

        return false;
    })();

    function transitionEnd(element) {
        var deferred = _deferred();

        if (!_transitionEndEvent || !element.length) {
            deferred.resolve();
        } else {
            element.one(_transitionEndEvent, deferred.resolve);
            setTimeout(deferred.resolve, 500);
        }

        return deferred.promise();
    }

    function settings(currSettings, key, value) {
        if (arguments.length === 1) {
            return $.extend({}, currSettings);
        }

        if (typeof key === 'string') {
            if (typeof value === 'undefined') {
                return typeof currSettings[key] === 'undefined'
                    ? null
                    : currSettings[key];
            }

            currSettings[key] = value;
        } else {
            $.extend(currSettings, key);
        }

        return this;
    }

    function parseQueryParams(params) {
        var pairs = decodeURI(params.split('#')[0]).split('&');
        var obj = {}, p;

        for (var i = 0, n = pairs.length; i < n; i++) {
            if (!pairs[i]) {
                continue;
            }

            p = pairs[i].split('=');
            obj[p[0]] = p[1];
        }

        return obj;
    }

    function appendQueryParams(url, params) {
        return url + (url.indexOf('?') > -1 ? '&' : '?') + $.param(params);
    }

    function transferHash(originalUrl, newUrl) {
        var pos = originalUrl.indexOf('#');

        if (-1 === pos) {
            return newUrl;
        }

        if (pos > 0) {
            originalUrl = originalUrl.substr(pos);
        }

        return newUrl + originalUrl;
    }

    function error(msg) {
        return $('<span class="lity-error"></span>').append(msg);
    }

    function imageHandler(target, instance) {
        var desc = (instance.opener() && instance.opener().data('lity-desc')) || 'Image with no description';
        var img = $('<img src="' + target + '" alt="' + desc + '"/>');
        var deferred = _deferred();
        var failed = function () {
            deferred.reject(error('Failed loading image'));
        };

        img
            .on('load', function () {
                if (this.naturalWidth === 0) {
                    return failed();
                }

                deferred.resolve(img);
            })
            .on('error', failed)
            ;

        return deferred.promise();
    }

    imageHandler.test = function (target) {
        return _imageRegexp.test(target);
    };

    function inlineHandler(target, instance) {
        var el, placeholder, hasHideClass;

        try {
            el = $(target);
        } catch (e) {
            return false;
        }

        if (!el.length) {
            return false;
        }

        placeholder = $('<i style="display:none !important"></i>');
        hasHideClass = el.hasClass('lity-hide');

        instance
            .element()
            .one('lity:remove', function () {
                placeholder
                    .before(el)
                    .remove()
                    ;

                if (hasHideClass && !el.closest('.lity-content').length) {
                    el.addClass('lity-hide');
                }
            })
            ;

        return el
            .removeClass('lity-hide')
            .after(placeholder)
            ;
    }

    function youtubeHandler(target) {
        var matches = _youtubeRegex.exec(target);

        if (!matches) {
            return false;
        }

        return iframeHandler(
            transferHash(
                target,
                appendQueryParams(
                    'https://www.youtube' + (matches[2] || '') + '.com/embed/' + matches[4],
                    $.extend(
                        {
                            autoplay: 1
                        },
                        parseQueryParams(matches[5] || '')
                    )
                )
            )
        );
    }

    function vimeoHandler(target) {
        var matches = _vimeoRegex.exec(target);

        if (!matches) {
            return false;
        }

        return iframeHandler(
            transferHash(
                target,
                appendQueryParams(
                    'https://player.vimeo.com/video/' + matches[3],
                    $.extend(
                        {
                            autoplay: 1
                        },
                        parseQueryParams(matches[4] || '')
                    )
                )
            )
        );
    }

    function facebookvideoHandler(target) {
        var matches = _facebookvideoRegex.exec(target);

        if (!matches) {
            return false;
        }

        if (0 !== target.indexOf('http')) {
            target = 'https:' + target;
        }

        return iframeHandler(
            transferHash(
                target,
                appendQueryParams(
                    'https://www.facebook.com/plugins/video.php?href=' + target,
                    $.extend(
                        {
                            autoplay: 1
                        },
                        parseQueryParams(matches[4] || '')
                    )
                )
            )
        );
    }

    function googlemapsHandler(target) {
        var matches = _googlemapsRegex.exec(target);

        if (!matches) {
            return false;
        }

        return iframeHandler(
            transferHash(
                target,
                appendQueryParams(
                    'https://www.google.' + matches[3] + '/maps?' + matches[6],
                    {
                        output: matches[6].indexOf('layer=c') > 0 ? 'svembed' : 'embed'
                    }
                )
            )
        );
    }

    function iframeHandler(target) {
        return '<div class="lity-iframe-container"><iframe frameborder="0" allowfullscreen src="' + target + '"></iframe></div>';
    }

    function winHeight() {
        return document.documentElement.clientHeight
            ? document.documentElement.clientHeight
            : Math.round(_win.height());
    }

    function keydown(e) {
        var current = currentInstance();

        if (!current) {
            return;
        }

        // ESC key
        if (e.keyCode === 27 && !!current.options('esc')) {
            current.close();
        }

        // TAB key
        if (e.keyCode === 9) {
            handleTabKey(e, current);
        }
    }

    function handleTabKey(e, instance) {
        var focusableElements = instance.element().find(_focusableElementsSelector);
        var focusedIndex = focusableElements.index(document.activeElement);

        if (e.shiftKey && focusedIndex <= 0) {
            focusableElements.get(focusableElements.length - 1).focus();
            e.preventDefault();
        } else if (!e.shiftKey && focusedIndex === focusableElements.length - 1) {
            focusableElements.get(0).focus();
            e.preventDefault();
        }
    }

    function resize() {
        $.each(_instances, function (i, instance) {
            instance.resize();
        });
    }

    function registerInstance(instanceToRegister) {
        if (1 === _instances.unshift(instanceToRegister)) {
            _html.addClass('lity-active');

            _win
                .on({
                    resize: resize,
                    keydown: keydown
                })
                ;
        }

        $('body > *').not(instanceToRegister.element())
            .addClass('lity-hidden')
            .each(function () {
                var el = $(this);

                if (undefined !== el.data(_dataAriaHidden)) {
                    return;
                }

                el.data(_dataAriaHidden, el.attr(_attrAriaHidden) || null);
            })
            .attr(_attrAriaHidden, 'true')
            ;
    }

    function removeInstance(instanceToRemove) {
        var show;

        instanceToRemove
            .element()
            .attr(_attrAriaHidden, 'true')
            ;

        if (1 === _instances.length) {
            _html.removeClass('lity-active');

            _win
                .off({
                    resize: resize,
                    keydown: keydown
                })
                ;
        }

        _instances = $.grep(_instances, function (instance) {
            return instanceToRemove !== instance;
        });

        if (!!_instances.length) {
            show = _instances[0].element();
        } else {
            show = $('.lity-hidden');
        }

        show
            .removeClass('lity-hidden')
            .each(function () {
                var el = $(this), oldAttr = el.data(_dataAriaHidden);

                if (!oldAttr) {
                    el.removeAttr(_attrAriaHidden);
                } else {
                    el.attr(_attrAriaHidden, oldAttr);
                }

                el.removeData(_dataAriaHidden);
            })
            ;
    }

    function currentInstance() {
        if (0 === _instances.length) {
            return null;
        }

        return _instances[0];
    }

    function factory(target, instance, handlers, preferredHandler) {
        var handler = 'inline', content;

        var currentHandlers = $.extend({}, handlers);

        if (preferredHandler && currentHandlers[preferredHandler]) {
            content = currentHandlers[preferredHandler](target, instance);
            handler = preferredHandler;
        } else {
            // Run inline and iframe handlers after all other handlers
            $.each(['inline', 'iframe'], function (i, name) {
                delete currentHandlers[name];

                currentHandlers[name] = handlers[name];
            });

            $.each(currentHandlers, function (name, currentHandler) {
                // Handler might be "removed" by setting callback to null
                if (!currentHandler) {
                    return true;
                }

                if (
                    currentHandler.test &&
                    !currentHandler.test(target, instance)
                ) {
                    return true;
                }

                content = currentHandler(target, instance);

                if (false !== content) {
                    handler = name;
                    return false;
                }
            });
        }

        return { handler: handler, content: content || '' };
    }

    function Lity(target, options, opener, activeElement) {
        var self = this;
        var result;
        var isReady = false;
        var isClosed = false;
        var element;
        var content;

        options = $.extend(
            {},
            _defaultOptions,
            options
        );

        element = $(options.template);

        // -- API --

        self.element = function () {
            return element;
        };

        self.opener = function () {
            return opener;
        };

        self.options = $.proxy(settings, self, options);
        self.handlers = $.proxy(settings, self, options.handlers);

        self.resize = function () {
            if (!isReady || isClosed) {
                return;
            }

            content
                .css('max-height', winHeight() + 'px')
                .trigger('lity:resize', [self])
                ;
        };

        self.close = function () {
            if (!isReady || isClosed) {
                return;
            }

            isClosed = true;

            removeInstance(self);

            var deferred = _deferred();

            // We return focus only if the current focus is inside this instance
            if (
                activeElement &&
                (
                    document.activeElement === element[0] ||
                    $.contains(element[0], document.activeElement)
                )
            ) {
                try {
                    activeElement.focus();
                } catch (e) {
                    // Ignore exceptions, eg. for SVG elements which can't be
                    // focused in IE11
                }
            }

            content.trigger('lity:close', [self]);

            element
                .removeClass('lity-opened')
                .addClass('lity-closed')
                ;

            transitionEnd(content.add(element))
                .always(function () {
                    content.trigger('lity:remove', [self]);
                    element.remove();
                    element = undefined;
                    deferred.resolve();
                })
                ;

            return deferred.promise();
        };

        // -- Initialization --

        result = factory(target, self, options.handlers, options.handler);

        element
            .attr(_attrAriaHidden, 'false')
            .addClass('lity-loading lity-opened lity-' + result.handler)
            .appendTo('body')
            .focus()
            .on('click', '[data-lity-close]', function (e) {
                if ($(e.target).is('[data-lity-close]')) {
                    self.close();
                }
            })
            .trigger('lity:open', [self])
            ;

        registerInstance(self);

        $.when(result.content)
            .always(ready)
            ;

        function ready(result) {
            content = $(result)
                .css('max-height', winHeight() + 'px')
                ;

            element
                .find('.lity-loader')
                .each(function () {
                    var loader = $(this);

                    transitionEnd(loader)
                        .always(function () {
                            loader.remove();
                        })
                        ;
                })
                ;

            element
                .removeClass('lity-loading')
                .find('.lity-content')
                .empty()
                .append(content)
                ;

            isReady = true;

            content
                .trigger('lity:ready', [self])
                ;
        }
    }

    function lity(target, options, opener) {
        if (!target.preventDefault) {
            opener = $(opener);
        } else {
            target.preventDefault();
            opener = $(this);
            target = opener.data('lity-target') || opener.attr('href') || opener.attr('src');
        }

        var instance = new Lity(
            target,
            $.extend(
                {},
                opener.data('lity-options') || opener.data('lity'),
                options
            ),
            opener,
            document.activeElement
        );

        if (!target.preventDefault) {
            return instance;
        }
    }

    lity.version = '2.2.2';
    lity.options = $.proxy(settings, lity, _defaultOptions);
    lity.handlers = $.proxy(settings, lity, _defaultOptions.handlers);
    lity.current = currentInstance;

    $(document).on('click.lity', '[data-lity]', lity);

    return lity;
}));

$(document).ready(function () {
    const topNavBar = `
  <div id="x_topNavBar" style="
    display: flex;
    flex-direction: column;
    border-top: 3px solid #d7d7d7;
    z-index: 1000;
    width: 100%;
    min-width: 320px;
    position: absolute;
    bottom: 4px;
    padding: 10px 15px 5px 15px;
    background: white;
    gap: 8px;
    font-family: sans-serif;
    box-sizing: border-box;
  ">
  <div class="container" style="display: flex; justify-content: space-between; width: 100%; margin: 0; align-items: center;">
   <div class="nav-container" style="display: flex; gap: 5px; flex-shrink: 0;">
   <button id="x_prevBtn_top" class="nav-button" title="Vorige" aria-label="Vorige" style="min-width: 40px; height: 40px; border: none; background: #f0f0f0; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <span class="ui-button-icon-primary">
        <i class="fa fa-chevron-left" aria-hidden="true"></i>
      </span>
    </button>
     <button id="x_menuBtn_top" class="nav-button" title="Inhoud" aria-label="Inhoud" style="min-width: 40px; height: 40px; border: none; background: #f0f0f0; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <span class="ui-button-icon-primary">
        <i class="fa fa-bars" aria-hidden="true"></i>
      </span>
    </button>
     <button id="x_menuBtn_home" class="nav-button" title="Inhoud" aria-label="Inhoud" style="min-width: 40px; height: 40px; border: none; background: #f0f0f0; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <span class="ui-button-icon-primary">
        <i class="fa fa-home" aria-hidden="true"></i>
      </span>
    </button>
  
   </div>

    <div id="x_progressBarContainer" style="flex: 1; padding: 0 15px; align-self: center; min-width: 0; display:flex; align-items:center; gap:8px;">
    <div id="x_progressBarWrapper" style="background: #e0e0e0; border-radius: 20px; height: 12px; width: 100%; overflow: hidden; min-width: 60px;">
        <div id="x_progressBar" style="height: 100%; width: 0%; background-color: #7E1AE3; border-radius: 20px; transition: width 0.3s ease;"></div>
    </div>
    <div id="x_progressCount" style="min-width:48px; text-align:right; font-weight:700; color:#444; font-size:0.95rem; margin-left:8px;">&nbsp;</div>
    </div>

    <button id="x_nextBtn_top" class="" title="Volgende" aria-label="Volgende" style="min-width: 80px; height: 40px; border: none; background: #7E1AE3; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; flex-shrink: 0; padding: 0 12px;">
      <span class="" style="font-weight: bold; font-size: 14px;">
        verder
      </span>
    </button>

    <script>
      (function(){
        function logNextLabelTheme(){
          try{
            var b = document.getElementById('x_nextBtn_top');
            if(b) console.log('Theme Woordtrainer: x_nextBtn_top label="' + (b.textContent || b.innerText).trim() + '"');
            else console.log('Theme Woordtrainer: x_nextBtn_top not found');
          }catch(e){ console.log('Theme Woordtrainer: error reading x_nextBtn_top', e); }
        }
        if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(logNextLabelTheme,50);
        else document.addEventListener('DOMContentLoaded', logNextLabelTheme);
      })();
    </script>

  </div>
  </div>
  <div id="ttsSettingsModal" class="modal hidden">
  <div class="modal-content">
    <span class="close-button">&times;</span>
    <h2>Voorleesinstellingen</h2>

    <label for="voiceSelect">Kies een stem:</label>
    <select id="voiceSelect" class="instellingenSelect"></select>

    <div style="margin-top: 1rem;">
      <label for="rateSelect">Spreeksnelheid:</label>
      <select id="rateSelect" class="instellingenSelect">
        <option value="0.7">🐢 Langzaam</option>
        <option value="1.0">⚖️ Normaal</option>
        <option value="1.3">🐇 Snel</option>
      </select>
    </div>
    <div style="margin-top: 1.5rem; text-align: right;">
    <button id="testVoiceBtn" class="voorleesKnop">test de stem</button>
    </div>
  </div>
</div>
<style>
#testVoiceBtn {
  cursor: pointer;
}

/* Responsive navigation bar styles */
@media (max-width: 768px) {
  #x_topNavBar {
    padding: 8px 10px 3px 10px !important;
    gap: 8px !important;
  }
  
  #x_topNavBar .container {
    gap: 8px !important;
    flex-wrap: wrap !important;
    row-gap: 6px !important;
  }
  
  #x_topNavBar .nav-container {
    gap: 3px !important;
    order: 1 !important;
  }
  
  #x_topNavBar .nav-button {
    min-width: 36px !important;
    height: 36px !important;
  }
  
  #x_nextBtn_top {
    min-width: 70px !important;
    height: 36px !important;
    padding: 0 8px !important;
    order: 2 !important;
  }
  
  #x_nextBtn_top span {
    font-size: 12px !important;
  }
  
  #x_progressBarContainer {
    order: 3 !important;
    flex: 1 1 100% !important;
    padding: 0 !important;
  }
  
  #x_progressBarWrapper {
    height: 10px !important;
  }
}

@media (max-width: 480px) {
  #x_topNavBar {
    padding: 6px 8px 2px 8px !important;
    gap: 8px !important;
  }
  
  #x_topNavBar .container {
    gap: 6px !important;
  }
  
  #x_topNavBar .nav-container {
    gap: 2px !important;
  }
  
  #x_topNavBar .nav-button {
    min-width: 32px !important;
    height: 32px !important;
  }
  
  #x_nextBtn_top {
    min-width: 60px !important;
    height: 32px !important;
    padding: 0 6px !important;
  }
  
  #x_nextBtn_top span {
    font-size: 11px !important;
  }
  
  #x_progressBarWrapper {
    height: 8px !important;
  }
}

@media (max-width: 360px) {
  #x_topNavBar {
    padding: 5px 6px 1px 6px !important;
    gap: 4px !important;
  }
  
  #x_topNavBar .container {
    gap: 4px !important;
  }
  
  #x_topNavBar .nav-container {
    gap: 1px !important;
  }
  
  #x_topNavBar .nav-button {
    min-width: 28px !important;
    height: 28px !important;
  }
  
  #x_nextBtn_top {
    min-width: 50px !important;
    height: 28px !important;
    padding: 0 4px !important;
  }
  
  #x_nextBtn_top span {
    font-size: 10px !important;
  }
  
  #x_progressBarWrapper {
    height: 6px !important;
  }
}
.modal {
  position: fixed;
  z-index: 10000;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  position: relative;
}

.close-button {
  position: absolute;
  top: 10px; right: 15px;
  font-size: 24px;
  cursor: pointer;
}

.instellingenSelect {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
}
</style>
`;

    // Insert it before the footer
    $("#x_footerBlock").before(topNavBar);

    // Click bindings
    $("#x_prevBtn_top").click(function () {
        $("#x_prevBtn").click();
    });

    $("#x_menuBtn_home").click(function () {
        loadWoordtrainerPublicSettings().then(function (cfg) {
            var url = (cfg && cfg.home_url) ? String(cfg.home_url).trim() : '';
            if (url) {
                window.location.href = url;
                return;
            }
            if (typeof x_goHome === 'function') {
                x_goHome();
            } else if (typeof x_changePage === 'function') {
                x_changePage(0);
            }
        });
    });

    $("#x_menuBtn_top").click(function () {
        try {
            // find first page that uses title.html model (type 'title')
            var targetIndex = 0;
            for (var i = 0; i < x_pageInfo.length; i++) {
                if (x_pageInfo[i].standalone != true && x_pageInfo[i].type == 'title') { 
                    targetIndex = i; 
                    break; 
                }
            }
            if (typeof x_navigateToPage === 'function') {
                x_navigateToPage(true, { type: 'index', ID: targetIndex });
            } else if (typeof x_changePage === 'function') {
                x_changePage(targetIndex);
            } else {
                x_goHome();
            }
        } catch(e) {
            if (typeof x_goHome === 'function') {
                x_goHome();
            } else if (typeof x_changePage === 'function' && x_normalPages && x_normalPages.length > 0) {
                x_changePage(x_normalPages[0]);
            }
        }
    });

    $("#x_nextBtn_top").click(function () {
        $("#x_nextBtn").click();
    });

    // Progress bar logic is implemented in xenith.js (x_updateTopProgressBar).
    // Keep a thin wrapper here for backward compatibility.
    function syncPageNoTop() {
        if (typeof x_updateTopProgressBar === "function") {
            x_updateTopProgressBar();
        }
    }

    // Run once on load; further updates are triggered from xenith.js via x_setUpPage
    syncPageNoTop();

    // (no polling or extra wt:exerciseDone listener injected by theme)

    // Open modal
    $("#x_settingsBtn_top").on("click", () => {
        $("#ttsSettingsModal").removeClass("hidden");
    });

    // Close modal
    $(".close-button").on("click", () => {
        $("#ttsSettingsModal").addClass("hidden");
    });

    // Speech settings with localStorage
    let selectedVoice = null;
    let availableVoices = [];
    let selectedRate = localStorage.getItem("ttsRate") || "1.0";
    let selectedVoiceName = localStorage.getItem("ttsVoice") || null;

    // Populate voices
    function loadVoices() {
        availableVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("nl"));
        if (availableVoices.length === 0) availableVoices = window.speechSynthesis.getVoices();

        const voiceSelect = $("#voiceSelect");
        voiceSelect.empty();


        availableVoices.forEach(voice => {
            const option = $("<option>").val(voice.name).text(`${voice.name} (${voice.lang})`);
            if (voice.name === selectedVoiceName) option.attr("selected", true);
            voiceSelect.append(option);
        });

        selectedVoice = availableVoices.find(v => v.name === selectedVoiceName) || availableVoices[0];
        if (selectedVoice) localStorage.setItem("ttsVoice", selectedVoice.name);
    }

    // Apply rate change
    $("#rateSelect").val(selectedRate);
    $("#rateSelect").on("change", function () {
        selectedRate = $(this).val();
        localStorage.setItem("ttsRate", selectedRate);
    });

    // Apply voice change
    $("#voiceSelect").on("change", function () {
        selectedVoiceName = $(this).val();
        localStorage.setItem("ttsVoice", selectedVoiceName);
        selectedVoice = availableVoices.find(v => v.name === selectedVoiceName);
    });

    // Ensure voices load in all browsers
    if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }

    // Test voice button
    $("#testVoiceBtn").on("click", () => {
        const testText = "Dit is een voorbeeld van mijn stem.";
        const utterance = new SpeechSynthesisUtterance(testText);

        const voiceName = localStorage.getItem("ttsVoice");
        const rate = parseFloat(localStorage.getItem("ttsRate") || "1.0");
        const voice = availableVoices.find(v => v.name === voiceName) || availableVoices[0];

        utterance.voice = voice;
        utterance.lang = voice?.lang || 'nl-NL';
        utterance.rate = rate;

        speechSynthesis.cancel(); // Stop any previous speech
        speechSynthesis.speak(utterance);
    });

})
