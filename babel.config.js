module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: [
        // Si vous utilisez 'react-native-reanimated', cette ligne est OBLIGATOIRE.
        // Si vous ne l'utilisez pas, vous pouvez supprimer la ligne ci-dessous.
        'react-native-reanimated/plugin',
      ],
    };
  };