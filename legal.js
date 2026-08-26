import { db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml, showMessage } from './utils.js';
import { getLanguage, t } from './i18n.js';

export const TERMS_VERSION = 'v1.0.0';
export const TERMS_FINGERPRINT = 'cms-terms-v1-2026-08-26';

const termsContent = {
    en: {
        title: 'Terms of Use',
        subtitle: `Version ${TERMS_VERSION} · Please read and accept before using the system.`,
        intro: 'Vehicle Management System Terms of Use',
        items: [
            'Use the system only for authorised purposes, keep your login credentials confidential, and do not share them with any person.',
            'Do not misuse, tamper with, bypass access controls, enter false information, or use another user’s account.',
            'Review notices shown in your account, especially vehicle-assignment and violation notices linked to your record.',
            'Notify management immediately through internal messaging if a vehicle appears to be linked to your account incorrectly or if you need clarification about a violation linked to your record.',
            'Understand that custody starts at the time of your assignment to the vehicle in the system and that a custody-release request does not close the record until management approves it.',
            'Understand that violations are linked using vehicle details, occurrence time, and custody records. A clarification or review request does not automatically delete the original record.',
            'Accept that the system stores the consent, notices, and messages needed for administration and internal audit. All authorised administrators may view and reply to internal messages for administration, follow-up, and audit purposes.'
        ],
        consent: 'I have read and agree to the Terms of Use.',
        submit: 'Accept and Continue',
        required: 'You must confirm that you have read and agree to the Terms of Use before continuing.',
        saving: 'Saving acceptance...',
        saved: 'Terms accepted. You can now use the system.',
        failed: 'Unable to save your acceptance. Please try again.'
    },
    ar: {
        title: 'اتفاقية الاستخدام',
        subtitle: `الإصدار ${TERMS_VERSION} · يرجى القراءة والموافقة قبل استخدام النظام.`,
        intro: 'اتفاقية استخدام نظام إدارة المركبات',
        items: [
            'استخدام النظام للأغراض المصرح بها فقط، والمحافظة على سرية بيانات الدخول وعدم مشاركتها مع أي شخص.',
            'عدم إساءة استخدام النظام أو العبث بسجلاته أو محاولة تجاوز الصلاحيات أو إدخال بيانات غير صحيحة أو استخدام حساب مستخدم آخر.',
            'مراجعة الإشعارات الظاهرة في الحساب، ولا سيما إشعارات تعيين المركبات والمخالفات المرتبطة بالسجل الشخصي.',
            'إبلاغ الإدارة فوراً عبر الرسائل الداخلية إذا ظهرت مركبة مرتبطة بالحساب بالخطأ أو عند الحاجة إلى توضيح بشأن مخالفة مرتبطة بالسجل.',
            'العلم بأن العهدة تبدأ من وقت التعيين على المركبة في النظام، وأن طلب فك العهدة لا ينهي السجل إلا بعد اعتماد الإدارة له.',
            'العلم بأن ربط المخالفات يعتمد على بيانات المركبة ووقت الواقعة وسجل العهدة، وأن طلب التوضيح أو المراجعة لا يحذف السجل الأصلي تلقائياً.',
            'قبول حفظ سجل الموافقة والإشعارات والرسائل اللازمة للإدارة والتدقيق الداخلي، والعلم بأن جميع المسؤولين المخولين قد يطّلعون على الرسائل الداخلية ويجيبون عنها لأغراض الإدارة والمتابعة والتدقيق.'
        ],
        consent: 'أقر بأنني قرأت اتفاقية الاستخدام وأوافق عليها.',
        submit: 'أوافق وأتابع',
        required: 'يجب تأكيد قراءة اتفاقية الاستخدام والموافقة عليها قبل المتابعة.',
        saving: 'جارٍ حفظ الموافقة...',
        saved: 'تم حفظ الموافقة. يمكنك الآن استخدام النظام.',
        failed: 'تعذر حفظ الموافقة. يرجى إعادة المحاولة.'
    }
};

function acceptanceRef(userId) {
    return doc(db, 'termsAcceptances', userId, 'versions', TERMS_VERSION);
}

function currentContent() {
    return termsContent[getLanguage() === 'ar' ? 'ar' : 'en'];
}

export async function hasAcceptedCurrentTerms(userId) {
    if (!userId) return false;
    const snapshot = await getDoc(acceptanceRef(userId));
    const data = snapshot.exists() ? snapshot.data() : null;
    return Boolean(data && data.userId === userId && data.termsVersion === TERMS_VERSION && data.termsFingerprint === TERMS_FINGERPRINT);
}

export function renderTermsAgreement(userData, onAccepted) {
    const container = document.getElementById('dashboard-container');
    if (!container || !userData?.uid) return;
    const content = currentContent();
    const itemHtml = content.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');

    container.innerHTML = `
        <section class="legal-gate-card" aria-labelledby="terms-title">
            <div class="legal-gate-header">
                <span class="legal-gate-kicker">${escapeHtml(content.intro)}</span>
                <h2 id="terms-title">${escapeHtml(content.title)}</h2>
                <p>${escapeHtml(content.subtitle)}</p>
            </div>
            <div class="legal-terms-scroll" tabindex="0">
                <ol>${itemHtml}</ol>
            </div>
            <form id="terms-acceptance-form" class="legal-acceptance-form" novalidate>
                <label class="legal-consent-row" for="terms-consent-checkbox">
                    <input type="checkbox" id="terms-consent-checkbox" required>
                    <span>${escapeHtml(content.consent)}</span>
                </label>
                <button type="submit" class="btn" id="terms-acceptance-submit">${escapeHtml(content.submit)}</button>
            </form>
        </section>
    `;

    const form = document.getElementById('terms-acceptance-form');
    const checkbox = document.getElementById('terms-consent-checkbox');
    const submit = document.getElementById('terms-acceptance-submit');
    if (!form || !checkbox || !submit) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const liveContent = currentContent();
        if (!checkbox.checked) {
            showMessage(liveContent.required, 'error', 'dashboard');
            return;
        }

        submit.disabled = true;
        submit.textContent = liveContent.saving;
        try {
            await setDoc(acceptanceRef(userData.uid), {
                userId: userData.uid,
                usernameSnapshot: String(userData.username || '').slice(0, 40),
                termsVersion: TERMS_VERSION,
                termsFingerprint: TERMS_FINGERPRINT,
                acceptedLocale: getLanguage(),
                acceptedAt: serverTimestamp()
            });
            showMessage(liveContent.saved, 'success', 'dashboard');
            if (typeof onAccepted === 'function') onAccepted();
        } catch (error) {
            console.error('Terms acceptance save failed:', error);
            showMessage(liveContent.failed, 'error', 'dashboard');
            submit.disabled = false;
            submit.textContent = liveContent.submit;
        }
    });
}

export function getTermsVersion() {
    return TERMS_VERSION;
}
