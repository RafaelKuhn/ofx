import vitePluginRequire from "vite-plugin-require";

export default {
	plugins: [

		//  Must be placed after the vue plugin
		// vitePluginRequire(),

		// vite4、vite5
		vitePluginRequire.default(),
	],
};