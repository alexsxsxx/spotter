import { Application, SpotterOptionBase, SpotterShell } from './interfaces';

export const spotterSearch = (
  query: string,
  options: SpotterOptionBase[],
  prefix?: string,
): SpotterOptionBase[] => {
  if (!query || !options?.length) {
    return [];
  };

  if (!prefix) {
    return search(query, options);
  };

  const [ prefixFromQuery, ...restQuery ] = query.split(' ');
  const queryWithoutPrefix = restQuery.join(' ');

  if (prefix.toLowerCase().includes(prefixFromQuery.toLowerCase())) {
    return search(queryWithoutPrefix, options);
  };

  return [];
};

const search = (query: string, options: SpotterOptionBase[]): SpotterOptionBase[] => {
  if (!query && options?.length) {
    return options;
  };

  if (!options?.length) {
    return [];
  };

  return options
    .filter((item: SpotterOptionBase) => item.title?.toLowerCase().includes(query?.toLowerCase()))
    .sort((a, b) => a.title?.indexOf(query) - b.title?.indexOf(query));
}

export const getAllApplications = async (shell: SpotterShell): Promise<Application[]> => {
  const paths = [
    '/System/Applications',
    '/System/Applications/Utilities',
    '/Applications',
  ];

  const applicationsStrings: Application[][] = await Promise.all(
    paths.map(async path =>
      await shell
        .execute(`cd ${path} && ls`)
        .then(res => res.split('\n')
          .filter(title => title.endsWith('.app') && title !== 'spotter.app')
          .map(title => ({ title: title.replace('.app', ''), path: `${path}/${title}` }))
        )
    ),
  );

  const applications = applicationsStrings.reduce((acc, apps) => ([...acc, ...apps]), []);

  return applications;
}

export const omit = (keys: string[], obj: { [key: string]: any }) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !keys.includes(k))
  )

