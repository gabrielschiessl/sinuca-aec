export function menuButton({ route, icon, text }) {
  return `

        <button 
            class="menu-button"
            data-route="${route}"
        >

            <i class="${icon}"></i>

            <span>
                ${text}
            </span>

        </button>

    `;
}
