from setuptools import setup, find_packages


with open('README.md') as f:
    readme = f.read()

with open('LICENSE') as f:
    license = f.read()

setup(
    name = 'jsdoop-py',
    version = '0.1.0',
    description = 'Distributed Object-Oriented Platform on the Browser. Python Version.',
    long_description = readme,
    author = 'José Ángel Morell',
    author_email = 'jamorell386@gmail.com',
    url = 'https://github.com/jsdoop/jsdoop',
    license = license,
    packages = find_packages(exclude = ('tests', 'docs'))
)
