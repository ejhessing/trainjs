%%angular_app_name%%.directive('head', function() {
	return {
		restrict: 'E',
		link: function(scope, elem, attrs) {
			elem.prepend('<link rel="shortcut icon" href="assets/images/favicon.ico">');
		}
	};
});
