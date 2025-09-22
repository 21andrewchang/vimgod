// tailwind.config.js
module.exports = {
	theme: {
		extend: {
			animation: {
				gradient: "gradient 8s linear infinite",
			},
			keyframes: {
				gradient: {
					to: {
						"background-position": "200% center",
					},
				},
			},
		},
	},
};
