import { useState } from 'preact/hooks';
import LeadForm from './LeadForm';

// Квиз «Как подобрать газовый котёл HUBERT» – вопросы и варианты как на /hubert оригинала.
// Расчёта на оригинале нет: ответы уходят с заявкой, специалист подбирает серию и мощность.
const QUESTIONS = [
  { key: 'heated_area', q: 'Какова общая отапливаемая площадь помещения?', a: ['До 100 м²', 'От 100 до 120 м²', 'От 120 до 180 м²', 'От 180 до 240 м²', 'От 240 до 300 м²', 'От 300 до 350 м²', 'Более 350 м²'] },
  { key: 'heat_retention', q: 'Оценили, насколько ваш дом хорошо держит тепло?', a: ['Дом долго не остывает при отключении тепла', 'Дом остывает за день', 'Дома становится холодно через несколько часов'] },
  { key: 'insulation', q: 'Какое утепление стен, пола и крыши?', a: ['Пенопласт / минвата (более 100 мм)', 'Кирпич без утепления', 'Деревянный брус', 'Панельный дом', 'Нет утепления'] },
  { key: 'heating_devices', q: 'Какой тип отопительных приборов установлен или планируется?', a: ['Алюминиевые', 'Биметаллические', 'Чугунные батареи', 'Тёплый пол (водяной)', 'Конвекторы'] },
  { key: 'boiler_usage', q: 'Как будет использоваться котёл?', a: ['Круглогодично (ПМЖ)', 'Только в отопительный сезон', 'Наездами (по выходным)'] },
  { key: 'hot_water', q: 'Нужна ли горячая вода из крана от этого котла?', a: ['Да, нужна постоянно', 'Да, только летом (отключение ГВС)', 'Нет, есть бойлер или колонка'] },
  { key: 'hot_water_users', q: 'Сколько человек будут пользоваться горячей водой одновременно?', a: ['От 1 до 3', 'От 3 до 4', 'От 4 до 6', 'Более 6'] },
  { key: 'budget', q: 'Какой бюджет на котёл с обвязкой?', a: ['Эконом (до 50 тыс. руб.)', 'Стандарт (50–70 тыс.)', 'Премиум (от 70 тыс.)', 'Не ограничен'] },
];

export default function HubertQuiz() {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [err, setErr] = useState(false);
  const total = QUESTIONS.length;
  const last = step === total;
  const cur = QUESTIONS[step];
  const pct = last ? 100 : Math.round(((step + 1) / total) * 100);

  const next = () => {
    if (!ans[cur.key]) return setErr(true);
    setErr(false);
    setStep(step + 1);
  };
  const extra = Object.fromEntries(QUESTIONS.map((x) => [x.q, ans[x.key] || '']));

  return (
    <div class="hq">
      <div class="hq__head">
        <span>{last ? 'Финальный шаг' : `Шаг ${step + 1} из ${total}`}</span>
        <b>{pct}%</b>
      </div>
      <div class="hq__bar"><i style={{ width: `${pct}%` }} /></div>
      {!last ? (
        <fieldset class="hq__step">
          <legend class="hq__q">{cur.q}</legend>
          <p class="hq__hint">Выберите один вариант</p>
          <div class="hq__opts">
            {cur.a.map((v) => (
              <label class={`hq__opt${ans[cur.key] === v ? ' is-on' : ''}`}>
                <input type="radio" name={cur.key} checked={ans[cur.key] === v} onChange={() => { setAns({ ...ans, [cur.key]: v }); setErr(false); }} />
                <span>{v}</span>
              </label>
            ))}
          </div>
          {err && <p class="form-err" role="alert">Выберите вариант, чтобы продолжить</p>}
          <div class="hq__nav">
            <button type="button" class="btn btn--outline btn--sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Назад</button>
            <button type="button" class="btn btn--navy btn--sm" onClick={next}>Далее</button>
          </div>
        </fieldset>
      ) : (
        <div class="hq__step">
          <p class="hq__q">Куда отправить рекомендацию?</p>
          <p class="hq__hint">Оставьте контакты – специалист свяжется с вами и поможет подобрать котёл.</p>
          <LeadForm form="Квиз: подбор котла HUBERT" button="Получить рекомендацию" extra={extra} />
          <button type="button" class="link" onClick={() => setStep(step - 1)}>Назад к вопросам</button>
        </div>
      )}
    </div>
  );
}
