const ROWS = [
  { title: "Senior Gameplay Engineer", studio: "Riot Games, remote" },
  { title: "Narrative Designer", studio: "Dream Games, remote" },
  { title: "Technical Artist", studio: "Roblox, hybrid" },
];

export function DigestTheater() {
  return (
    <div className="th5">
      <div className="t-mail th5__mail">
        <div className="t-mail__head">
          <div className="t-mail__from">Studio Direct digest</div>
          <div className="t-mail__subject">Hidden today: 3 roles not on LinkedIn</div>
        </div>
        {ROWS.map((row, index) => (
          <div className={`t-mail__row th5__row th5__row--${index + 1}`} key={row.title}>
            <div>
              <strong>{row.title}</strong>
              <span>{row.studio}</span>
            </div>
            <span className="t-badge">Not on LinkedIn</span>
          </div>
        ))}
      </div>
    </div>
  );
}
