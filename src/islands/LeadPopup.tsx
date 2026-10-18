import { leadItems, leadTopic, sheet } from '../lib/store';
import LeadForm from './LeadForm';
import Drawer from './Drawer';

// Попап заявки – как #popup:myform на оригинале («Введите свои контактные данные»).
// Открывается всеми кнопками с data-lead; data-lead="Название" подставляет тему заявки.
export default function LeadPopup() {
  const topic = leadTopic.value;
  return (
    <Drawer open={sheet.value === 'lead'} onClose={() => (sheet.value = null)} side="center" label="Заявка">
      <div class="lp">
        <button type="button" class="lead__x" aria-label="Закрыть" onClick={() => (sheet.value = null)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h2 class="lead__title">Оставьте заявку</h2>
        <p class="lead__text">Введите свои контактные данные – менеджер перезвонит, ответит на вопросы и поможет подобрать оборудование.</p>
        {topic !== 'Заявка с сайта' && <p class="lead__topic">{topic}</p>}
        <LeadForm form={topic} button="Отправить" items={leadItems.value} />
      </div>
    </Drawer>
  );
}
